import { AIProvider, Message, ProxySettings, Agent, SceneParticipant, SceneMessage, Scene } from '../types';
import { storageService } from './storage';
import { logService } from './log';

/**
 * AI服务类
 * 用于处理与AI提供商的通信
 */
class AIService {
  // 保存当前的请求控制器，用于取消请求
  private currentStreamController: AbortController | null = null;

  /**
   * 确保消息历史符合模型要求的格式
   * 特别是处理deepseek-reasoner需要严格交替的用户和助手消息的情况
   */
  private normalizeMessageHistory(
    history: { role: 'user' | 'assistant'; content: string }[],
    modelName: string
  ): { role: 'user' | 'assistant'; content: string }[] {
    // 如果不是deepseek-reasoner模型，不需要特殊处理
    if (modelName !== 'deepseek-reasoner') {
      return history;
    }

    logService.info(`为deepseek-reasoner模型规范化消息历史，原始消息数: ${history.length}`);
    
    // 如果历史为空，返回空数组
    if (!history || history.length === 0) {
      return [];
    }

    // 对于 deepseek-reasoner 模型，我们需要确保消息严格交替
    const normalizedHistory: { role: 'user' | 'assistant'; content: string }[] = [];
    
    // 首先确保历史中只保留非空消息
    const filteredHistory = history.filter(msg => msg.content.trim() !== '');
    
    // 如果没有有效消息，返回空数组
    if (filteredHistory.length === 0) {
      return [];
    }
    
    // 如果第一条消息不是用户消息，则丢弃它
    if (filteredHistory[0].role !== 'user') {
      filteredHistory.shift();
    }
    
    // 如果此时没有有效消息，返回空数组
    if (filteredHistory.length === 0) {
      return [];
    }
    
    // 开始构建严格交替的消息列表
    normalizedHistory.push(filteredHistory[0]); // 添加第一条用户消息
    
    // 从第二条消息开始，确保严格交替
    for (let i = 1; i < filteredHistory.length; i++) {
      const prevRole = normalizedHistory[normalizedHistory.length - 1].role;
      const currentMsg = filteredHistory[i];
      
      // 如果当前消息的角色与前一条不同，直接添加
      if (currentMsg.role !== prevRole) {
        normalizedHistory.push(currentMsg);
      } else {
        // 遇到连续相同角色的消息，合并内容
        const lastMsg = normalizedHistory[normalizedHistory.length - 1];
        lastMsg.content += "\n\n" + currentMsg.content;
        logService.debug(`合并连续的${currentMsg.role}消息`);
      }
    }
    
    // 确保最后一条消息是用户消息
    if (normalizedHistory.length > 0 && normalizedHistory[normalizedHistory.length - 1].role !== 'user') {
      // 移除最后一条助手消息
      normalizedHistory.pop();
      logService.debug('移除最后一条没有对应用户消息的助手消息');
    }
    
    logService.info(`规范化后的消息数: ${normalizedHistory.length}`);
    return normalizedHistory;
  }

  /**
   * 取消当前流式生成
   */
  cancelStream() {
    if (this.currentStreamController) {
      this.currentStreamController.abort();
      this.currentStreamController = null;
      logService.info('已取消流式生成');
    }
  }

  /**
   * 发送消息到AI并获取回复
   */
  async sendMessage(
    message: string, 
    providerId?: string,
    history?: { role: 'user' | 'assistant'; content: string }[],
    modelId?: string
  ): Promise<Message> {
    try {
      // 获取选中的提供商
      const id = providerId || storageService.getSelectedProviderId();
      const providers = storageService.getProviders();
      const provider = providers.find(p => p.id === id);
      
      if (!provider) {
        logService.error('找不到选中的AI提供商');
        throw new Error('找不到选中的AI提供商');
      }
      
      // 确定使用的模型ID
      let actualModelId = modelId;
      if (!actualModelId) {
        // 如果没有提供特定的模型ID，则使用提供商的默认模型
        if (provider.defaultModelId) {
          actualModelId = provider.defaultModelId;
        } else if (provider.models && provider.models.length > 0) {
          actualModelId = provider.models[0].id;
        }
      }
      
      if (!actualModelId) {
        logService.error('找不到可用的AI模型');
        throw new Error('找不到可用的AI模型');
      }
      
      // 获取代理设置
      const proxySettings = storageService.getProxySettings();
      
      // 调用真实的API
      const response = await this.callAI(message, provider, proxySettings, history, actualModelId, false);
      
      return {
        id: Date.now().toString(),
        content: response,
        role: 'assistant',
        timestamp: new Date()
      };
    } catch (error) {
      logService.error('AI服务错误', error);
      return {
        id: Date.now().toString(),
        content: '发生错误，请检查网络连接或API设置。' + (error instanceof Error ? ` 错误信息: ${error.message}` : ''),
        role: 'assistant',
        timestamp: new Date()
      };
    }
  }
  
  /**
   * 流式发送消息到AI并获取回复
   * @param message 用户消息
   * @param onUpdate 流式内容更新回调
   * @param providerId 提供商ID
   * @param history 聊天历史
   * @param modelId 模型ID
   */
  async sendMessageStream(
    message: string,
    onUpdate: (content: string, done: boolean, error?: boolean, reasoningContent?: string) => void,
    providerId?: string,
    history?: { role: 'user' | 'assistant'; content: string }[],
    modelId?: string
  ): Promise<void> {
    // 如果有正在进行的请求，先取消
    if (this.currentStreamController) {
      this.currentStreamController.abort();
    }
    
    // 创建新的AbortController
    this.currentStreamController = new AbortController();
    
    try {
      // 获取选中的提供商
      const id = providerId || storageService.getSelectedProviderId();
      const providers = storageService.getProviders();
      const provider = providers.find(p => p.id === id);
      
      if (!provider) {
        throw new Error('找不到选中的AI提供商');
      }
      
      // 确定使用的模型ID
      let actualModelId = modelId;
      if (!actualModelId) {
        // 如果没有提供特定的模型ID，则使用提供商的默认模型
        if (provider.defaultModelId) {
          actualModelId = provider.defaultModelId;
        } else if (provider.models && provider.models.length > 0) {
          actualModelId = provider.models[0].id;
        }
      }
      
      if (!actualModelId) {
        throw new Error('找不到可用的AI模型');
      }
      
      // 获取代理设置
      const proxySettings = storageService.getProxySettings();
      
      // 调用流式API
      await this.streamCallAI(
        message, 
        provider, 
        proxySettings, 
        onUpdate,
        this.currentStreamController.signal,
        history, 
        actualModelId
      );
    } catch (error) {
      logService.error('AI服务流式错误', error);
      
      // 检查是否是取消请求导致的错误
      if (error instanceof Error && error.name === 'AbortError') {
        onUpdate('生成已被用户中断', true, true);
      } else {
        onUpdate('发生错误，请检查网络连接或API设置。' + 
          (error instanceof Error ? ` 错误信息: ${error.message}` : ''), true, true);
      }
    } finally {
      this.currentStreamController = null;
    }
  }
  
  /**
   * 真实的API调用
   */
  private async callAI(
    message: string, 
    provider: AIProvider, 
    proxySettings: ProxySettings,
    history?: { role: 'user' | 'assistant'; content: string }[],
    modelId?: string,
    isStream: boolean = false,
    systemPrompt?: string
  ): Promise<string> {
    // 根据Provider的name判断使用哪种API格式
    let response;
    
    // 准备请求选项
    const options: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
    };
    
    // 添加API密钥到请求头
    if (provider.apiKey) {
      // 根据不同的AI提供商添加不同的认证格式
      if (provider.name.toLowerCase().includes('openai') || provider.name.toLowerCase().includes('chatgpt')) {
        options.headers = {
          ...options.headers,
          'Authorization': `Bearer ${provider.apiKey}`
        };
      } else if (provider.name.toLowerCase().includes('claude') || provider.name.toLowerCase().includes('anthropic')) {
        options.headers = {
          ...options.headers,
          'x-api-key': provider.apiKey,
          'anthropic-version': '2023-06-01' // Claude API版本
        };
      } else {
        // 默认使用Bearer认证
        options.headers = {
          ...options.headers,
          'Authorization': `Bearer ${provider.apiKey}`
        };
      }
    }
    
    // 调试输出
    logService.info(`发送消息到: ${provider.name}, 使用模型: ${modelId}`);
    logService.debug(`API端点: ${provider.apiEndpoint}`);
    logService.debug(`代理设置: ${proxySettings.enabled ? '已启用' : '未启用'}`);
    
    // 注意：在浏览器环境中，代理设置通常需要在服务器端处理
    // 或者使用特殊的代理配置扩展/中间件
    // 这里记录代理信息，但实际应用可能需要通过后端API转发请求
    if (proxySettings.enabled) {
      logService.debug(`使用代理: ${proxySettings.host}:${proxySettings.port}`);
      // 在Tauri应用中，可以考虑使用http客户端插件在Rust端处理代理
    }
    
    // 根据不同的AI提供商构建不同的请求体
    if (provider.name.toLowerCase().includes('openai') || provider.name.toLowerCase().includes('chatgpt')) {
      // OpenAI API格式
      const messages = [];
      
      // 添加系统提示词（如果有）
      if (systemPrompt) {
        messages.push({
          role: 'system',
          content: systemPrompt
        });
      }
      
      // 添加历史消息和当前消息
      messages.push(...(history || []),
      {
        role: 'user',
        content: message
      });
      
      options.body = JSON.stringify({
        model: modelId || 'gpt-3.5-turbo', // 使用传入的模型ID或默认模型
        messages: messages,
        temperature: 0.7,
        stream: false // 非流式模式
      });
      
      const fetchResponse = await fetch(provider.apiEndpoint, options);
      
      if (!fetchResponse.ok) {
        const errorText = await fetchResponse.text();
        throw new Error(`OpenAI API错误: ${fetchResponse.status} - ${errorText}`);
      }
      
      const data = await fetchResponse.json();
      response = data.choices[0].message.content;
      
    } else if (provider.name.toLowerCase().includes('claude') || provider.name.toLowerCase().includes('anthropic')) {
      // Claude/Anthropic API格式
      options.body = JSON.stringify({
        model: modelId || 'claude-2', // 使用传入的模型ID或默认模型
        prompt: `\n\nHuman: ${message}\n\nAssistant:`,
        max_tokens_to_sample: 1000,
        stream: false // 非流式模式
      });
      
      const fetchResponse = await fetch(provider.apiEndpoint, options);
      
      if (!fetchResponse.ok) {
        const errorText = await fetchResponse.text();
        throw new Error(`Claude API错误: ${fetchResponse.status} - ${errorText}`);
      }
      
      const data = await fetchResponse.json();
      response = data.completion;
    
    } else if (provider.name.toLowerCase().includes('deepseek')) {
      logService.info(`modelId: ${modelId}`);
      // 查找模型名称而不是使用ID
      let modelName = 'deepseek-chat'; // 默认使用DeepSeek-V3
      
      // 尝试从提供商的模型列表中找到模型名称
      if (modelId && provider.models) {
        logService.info(`处理DeepSeek模型ID: ${modelId}, 类型: ${typeof modelId}`);
        
        const selectedModel = provider.models.find(m => m.id === modelId);
        if (selectedModel) {
          // 使用模型的name属性判断
          const modelNameLower = selectedModel.name.toLowerCase();
          if (modelNameLower.includes('reasoner') || modelNameLower.includes('r1') || 
              selectedModel.id === 'deepseek-reasoner') {
            modelName = 'deepseek-reasoner';
          } else {
            modelName = 'deepseek-chat';
          }
          
          logService.info(`使用DeepSeek模型: ${modelName}, 模型名称: ${selectedModel.name}`);
        } else {
          logService.warn(`未找到匹配的DeepSeek模型: ${modelId}`);
        }
      }
      
      // 规范化消息历史，确保符合模型要求格式
      const normalizedHistory = this.normalizeMessageHistory(history || [], modelName);
      
      // 对于deepseek-reasoner模型，进行特殊处理并添加日志
      let messages = [];
      if (modelName === 'deepseek-reasoner') {
        // 如果历史为空，只添加当前用户消息
        if (normalizedHistory.length === 0) {
          messages = [{
            role: 'user',
            content: message
          }];
        } else {
          // 使用规范化后的历史，不再重复添加用户消息
          messages = normalizedHistory;
          
          // 如果最后一条消息是用户消息，和当前消息合并，避免连续的用户消息
          const lastMsg = normalizedHistory[normalizedHistory.length - 1];
          if (lastMsg && lastMsg.role === 'user') {
            // 替换掉最后一条用户消息，内容为当前消息
            messages[messages.length - 1] = {
              role: 'user',
              content: message
            };
          } else {
            // 最后一条是助手消息，正常添加当前用户消息
            messages.push({
              role: 'user',
              content: message
            });
          }
        }
      } else {
        // 非deepseek-reasoner模型，正常处理
        messages = [
          ...normalizedHistory,
          {
            role: 'user',
            content: message
          }
        ];
      }
      
      // 记录实际发送的消息内容
      logService.info(`DeepSeek ${modelName} 发送消息: ${JSON.stringify(messages)}`);
      
      // DeepSeek API格式 - 与OpenAI兼容
      options.body = JSON.stringify({
        model: modelName,
        messages: messages,
        stream: isStream,
        temperature: 0.7
      });
      
      // 确保使用正确的API端点
      let apiEndpoint = provider.apiEndpoint;
      if (!apiEndpoint || !apiEndpoint.startsWith('https://api.deepseek.com')) {
        apiEndpoint = 'https://api.deepseek.com/chat/completions';
        logService.warn(`DeepSeek API端点不正确，使用默认端点: ${apiEndpoint}`);
      } else if (!apiEndpoint.includes('/chat/completions')) {
        apiEndpoint = 'https://api.deepseek.com/chat/completions';
        logService.warn(`DeepSeek API端点不完整，使用完整端点: ${apiEndpoint}`);
      }
      
      const fetchResponse = await fetch(apiEndpoint, options);
      
      if (!fetchResponse.ok) {
        const errorText = await fetchResponse.text();
        throw new Error(`DeepSeek API错误: ${fetchResponse.status} - ${errorText}`);
      }
      
      const data = await fetchResponse.json();
      response = data.choices[0].message.content;
      
    } else {
      // 通用API格式处理
      // 假设格式为 { prompt: string, model: string }
      options.body = JSON.stringify({
        prompt: message,
        model: modelId,
        stream: false
      });
      
      const fetchResponse = await fetch(provider.apiEndpoint, options);
      
      if (!fetchResponse.ok) {
        const errorText = await fetchResponse.text();
        throw new Error(`API错误: ${fetchResponse.status} - ${errorText}`);
      }
      
      const data = await fetchResponse.json();
      
      // 尝试从响应中提取文本，根据可能的字段名
      response = data.text || data.content || data.response || data.message || 
                JSON.stringify(data);
    }
    
    return response;
  }
  
  /**
   * 流式API调用
   */
  private async streamCallAI(
    message: string, 
    provider: AIProvider, 
    proxySettings: ProxySettings,
    onUpdate: (content: string, done: boolean, error?: boolean, reasoningContent?: string) => void,
    abortSignal: AbortSignal,
    history?: { role: 'user' | 'assistant'; content: string }[],
    modelId?: string,
    systemPrompt?: string
  ): Promise<void> {
    // 准备请求选项
    const options: RequestInit = {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      signal: abortSignal, // 添加中断信号
    };
    
    // 添加API密钥到请求头
    if (provider.apiKey) {
      // 根据不同的AI提供商添加不同的认证格式
      if (provider.name.toLowerCase().includes('openai') || provider.name.toLowerCase().includes('chatgpt')) {
        options.headers = {
          ...options.headers,
          'Authorization': `Bearer ${provider.apiKey}`
        };
      } else if (provider.name.toLowerCase().includes('claude') || provider.name.toLowerCase().includes('anthropic')) {
        options.headers = {
          ...options.headers,
          'x-api-key': provider.apiKey,
          'anthropic-version': '2023-06-01' // Claude API版本
        };
      } else {
        // 默认使用Bearer认证
        options.headers = {
          ...options.headers,
          'Authorization': `Bearer ${provider.apiKey}`
        };
      }
    }
    
    // 调试输出
    logService.info(`流式发送消息到: ${provider.name}, 使用模型: ${modelId}`);
    logService.debug(`API端点: ${provider.apiEndpoint}`);
    
    let fullResponse = '';
    let reasoningFullResponse = ''; // 用于存储推理过程内容
    
    try {
      // 根据不同的AI提供商构建不同的请求体和处理流式响应
      if (provider.name.toLowerCase().includes('openai') || provider.name.toLowerCase().includes('chatgpt')) {
        // OpenAI API流式格式
        const messages = [];
        
        // 添加系统提示词（如果有）
        if (systemPrompt) {
          messages.push({
            role: 'system',
            content: systemPrompt
          });
        }
        
        // 添加历史消息和当前消息
        messages.push(...(history || []),
        {
          role: 'user',
          content: message
        });
        
        options.body = JSON.stringify({
          model: modelId || 'gpt-3.5-turbo',
          messages: messages,
          temperature: 0.7,
          stream: true // 启用流式返回
        });
        
        const response = await fetch(provider.apiEndpoint, options);
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`OpenAI API错误: ${response.status} - ${errorText}`);
        }
        
        if (!response.body) {
          throw new Error('响应不包含数据流');
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        
        // 处理数据流
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          // 解码数据块
          const chunk = decoder.decode(value, { stream: true });
          
          // 处理SSE格式数据
          const lines = chunk
            .split('\n')
            .filter(line => line.trim() !== '' && line.trim() !== 'data: [DONE]');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const jsonData = JSON.parse(line.slice(6));
                
                // 提取增量内容
                if (jsonData.choices && jsonData.choices[0].delta && jsonData.choices[0].delta.content) {
                  const content = jsonData.choices[0].delta.content;
                  fullResponse += content;
                  onUpdate(fullResponse, false);
                }
                
                // 提取推理内容
                if (jsonData.choices && jsonData.choices[0].delta && jsonData.choices[0].delta.reasoning_content) {
                  const reasoningContent = jsonData.choices[0].delta.reasoning_content;
                  reasoningFullResponse += reasoningContent;
                  logService.debug(`收到推理内容: ${reasoningContent}`);
                  onUpdate(fullResponse, false, false, reasoningFullResponse);
                }
              } catch (e) {
                console.error('解析SSE数据错误:', e);
              }
            }
          }
        }
        
        // 流式传输完成
        onUpdate(fullResponse, true, false, reasoningFullResponse);
        
      } else if (provider.name.toLowerCase().includes('claude') || provider.name.toLowerCase().includes('anthropic')) {
        // Claude API流式格式
        options.body = JSON.stringify({
          model: modelId || 'claude-2',
          prompt: `\n\nHuman: ${message}\n\nAssistant:`,
          max_tokens_to_sample: 1000,
          stream: true
        });
        
        const response = await fetch(provider.apiEndpoint, options);
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`Claude API错误: ${response.status} - ${errorText}`);
        }
        
        if (!response.body) {
          throw new Error('响应不包含数据流');
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        
        // 处理数据流
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          // 解码数据块
          const chunk = decoder.decode(value, { stream: true });
          
          // 处理SSE格式数据
          const lines = chunk
            .split('\n')
            .filter(line => line.trim() !== '' && line.trim() !== 'event: done');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const jsonData = JSON.parse(line.slice(6));
                
                // 提取增量内容
                if (jsonData.completion) {
                  fullResponse = jsonData.completion; // Claude返回完整的响应而不是增量
                  onUpdate(fullResponse, false);
                }
              } catch (e) {
                console.error('解析Claude SSE数据错误:', e);
              }
            }
          }
        }
        
        // 流式传输完成
        onUpdate(fullResponse, true, false, reasoningFullResponse);
        
      } else if (provider.name.toLowerCase().includes('deepseek')) {
        // 查找模型名称
        let modelName = 'deepseek-chat'; // 默认使用DeepSeek-V3
        
        if (modelId && provider.models) {
          logService.info(`处理DeepSeek模型ID: ${modelId}, 类型: ${typeof modelId}`);
          
          const selectedModel = provider.models.find(m => m.id === modelId);
          if (selectedModel) {
            // 使用模型的name属性判断
            const modelNameLower = selectedModel.name.toLowerCase();
            if (modelNameLower.includes('reasoner') || modelNameLower.includes('r1') || 
                selectedModel.id === 'deepseek-reasoner') {
              modelName = 'deepseek-reasoner';
            } else {
              modelName = 'deepseek-chat';
            }
            
            logService.info(`使用DeepSeek流式模型: ${modelName}, 模型名称: ${selectedModel.name}`);
          } else {
            logService.warn(`未找到匹配的DeepSeek模型: ${modelId}`);
          }
        }
        
        // 规范化消息历史，确保符合模型要求格式
        const normalizedHistory = this.normalizeMessageHistory(history || [], modelName);
        
        // 对于deepseek-reasoner模型，进行特殊处理并添加日志
        let messages = [];
        if (modelName === 'deepseek-reasoner') {
          // 如果历史为空，只添加当前用户消息
          if (normalizedHistory.length === 0) {
            messages = [{
              role: 'user',
              content: message
            }];
          } else {
            // 使用规范化后的历史，不再重复添加用户消息
            messages = normalizedHistory;
            
            // 如果最后一条消息是用户消息，和当前消息合并，避免连续的用户消息
            const lastMsg = normalizedHistory[normalizedHistory.length - 1];
            if (lastMsg && lastMsg.role === 'user') {
              // 替换掉最后一条用户消息，内容为当前消息
              messages[messages.length - 1] = {
                role: 'user',
                content: message
              };
            } else {
              // 最后一条是助手消息，正常添加当前用户消息
              messages.push({
                role: 'user',
                content: message
              });
            }
          }
        } else {
          // 非deepseek-reasoner模型，正常处理
          messages = [
            ...normalizedHistory,
            {
              role: 'user',
              content: message
            }
          ];
        }
        
        // 记录实际发送的消息内容
        logService.info(`DeepSeek ${modelName} 发送消息: ${JSON.stringify(messages)}`);
        
        // DeepSeek API格式 - 与OpenAI兼容
        options.body = JSON.stringify({
          model: modelName,
          messages: messages,
          stream: true,
          temperature: 0.7
        });
        
        // 确保使用正确的API端点
        let apiEndpoint = provider.apiEndpoint;
        if (!apiEndpoint || !apiEndpoint.startsWith('https://api.deepseek.com')) {
          apiEndpoint = 'https://api.deepseek.com/chat/completions';
        } else if (!apiEndpoint.includes('/chat/completions')) {
          apiEndpoint = 'https://api.deepseek.com/chat/completions';
        }
        
        const response = await fetch(apiEndpoint, options);
        
        if (!response.ok) {
          const errorText = await response.text();
          throw new Error(`DeepSeek API错误: ${response.status} - ${errorText}`);
        }
        
        if (!response.body) {
          throw new Error('响应不包含数据流');
        }
        
        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        
        // 处理数据流
        while (true) {
          const { done, value } = await reader.read();
          if (done) break;
          
          // 解码数据块
          const chunk = decoder.decode(value, { stream: true });
          
          // 处理SSE格式数据
          const lines = chunk
            .split('\n')
            .filter(line => line.trim() !== '' && line.trim() !== 'data: [DONE]');
          
          for (const line of lines) {
            if (line.startsWith('data: ')) {
              try {
                const jsonData = JSON.parse(line.slice(6));
                
                logService.info(`收到DeepSeek SSE数据: ${JSON.stringify(jsonData)}`);
                // 提取增量内容
                if (jsonData.choices && jsonData.choices[0].delta && jsonData.choices[0].delta.content) {
                  const content = jsonData.choices[0].delta.content;
                  fullResponse += content;
                  onUpdate(fullResponse, false);
                }
                
                // 提取推理内容
                if (jsonData.choices && jsonData.choices[0].delta && jsonData.choices[0].delta.reasoning_content) {
                  const reasoningContent = jsonData.choices[0].delta.reasoning_content;
                  reasoningFullResponse += reasoningContent;
                  logService.debug(`收到推理内容: ${reasoningContent}`);
                  onUpdate(fullResponse, false, false, reasoningFullResponse);
                }
              } catch (e) {
                console.error('解析DeepSeek SSE数据错误:', e);
              }
            }
          }
        }
        
        // 流式传输完成
        onUpdate(fullResponse, true, false, reasoningFullResponse);
      } else {
        // 对于不支持流式返回的API，退回到非流式调用
        logService.warn(`${provider.name} 不支持流式返回，使用非流式模式`);
        const response = await this.callAI(message, provider, proxySettings, history, modelId, false);
        onUpdate(response, true);
      }
    } catch (error) {
      console.error('流式API调用错误:', error);
      logService.error('流式API调用错误', error);
      throw error;
    }
  }
  
  /**
   * 测试API连接
   * 用于验证API设置是否正确
   */
  async testConnection(providerId: string): Promise<{ success: boolean; message: string }> {
    try {
      const providers = storageService.getProviders();
      const provider = providers.find(p => p.id === providerId);
      
      if (!provider) {
        return { 
          success: false, 
          message: '找不到选中的AI提供商' 
        };
      }
      
      if (!provider.apiKey) {
        return { 
          success: false, 
          message: 'API密钥未设置' 
        };
      }
      
      // 处理不同类型提供商的默认模型
      let testModelId = null;
      
      if (provider.name.toLowerCase().includes('deepseek')) {
        // DeepSeek使用标准模型名称
        testModelId = 'deepseek-chat'; // 默认使用DeepSeek-V3
        
        // 如果有默认模型且是有效的DeepSeek模型，使用它
        if (provider.defaultModelId) {
          const defaultModel = provider.models.find(m => m.id === provider.defaultModelId);
          if (defaultModel) {
            // 使用模型的name属性判断
            const modelNameLower = defaultModel.name.toLowerCase();
            testModelId = modelNameLower.includes('reasoner') || modelNameLower.includes('r1') ? 
              'deepseek-reasoner' : 'deepseek-chat';
          }
        }
        
        logService.info(`DeepSeek API测试使用模型: ${testModelId}`);
      } else {
        // 其他提供商正常使用模型ID
        testModelId = provider.defaultModelId;
        if (!testModelId && provider.models && provider.models.length > 0) {
          testModelId = provider.models[0].id;
        }
      }
      
      const proxySettings = storageService.getProxySettings();
      
      // 测试消息
      const testMessage = "这是一条测试消息，请简短回复以验证连接正常。";
      
      logService.info(`测试连接 ${provider.name}，使用模型: ${testModelId || '默认模型'}`);
      
      // 发送测试请求
      const response = await this.callAI(testMessage, provider, proxySettings, undefined, testModelId, false);
      
      return {
        success: true,
        message: `连接成功！收到回复: "${response.substring(0, 50)}${response.length > 50 ? '...' : ''}"`
      };
    } catch (error) {
      logService.error('测试连接失败:', error);
      return {
        success: false,
        message: `连接失败: ${error instanceof Error ? error.message : '未知错误'}`
      };
    }
  }
  
  /**
   * 使用特定Agent发送消息
   */
  async sendAgentMessage(
    message: string,
    agentId: string,
    history?: { role: 'user' | 'assistant'; content: string }[],
    onUpdate?: (content: string, done: boolean, error?: boolean, reasoningContent?: string) => void
  ): Promise<Message | void> {
    try {
      // 获取Agent配置
      const agent = storageService.getAgent(agentId);
      if (!agent) {
        throw new Error(`找不到Agent ID: ${agentId}`);
      }

      // 获取提供商
      const providers = storageService.getProviders();
      const provider = providers.find(p => p.id === agent.providerId);
      
      if (!provider) {
        throw new Error(`找不到Agent使用的AI提供商: ${agent.providerId}`);
      }

      // 获取代理设置
      const proxySettings = storageService.getProxySettings();
      
      // 验证模型是否存在
      const modelExists = provider.models.some(m => m.id === agent.modelId);
      if (!modelExists) {
        throw new Error(`找不到Agent使用的模型: ${agent.modelId}`);
      }

      // 如果消息历史为空，且Agent有系统提示词，则创建一个系统消息
      let enhancedHistory = history || [];
      if (agent.systemPrompt && enhancedHistory.length === 0) {
        enhancedHistory = [
          {
            role: 'assistant',
            content: agent.systemPrompt
          }
        ];
      } else if (agent.systemPrompt) {
        // 如果历史中第一条不是系统消息，则添加系统消息到历史开头
        const firstMessage = enhancedHistory[0];
        if (!firstMessage || firstMessage.role !== 'assistant' || firstMessage.content !== agent.systemPrompt) {
          enhancedHistory = [
            {
              role: 'assistant',
              content: agent.systemPrompt
            },
            ...enhancedHistory
          ];
        }
      }

      // 如果有消息更新回调，则使用流式响应
      if (onUpdate) {
        await this.streamCallAI(
          message,
          provider,
          proxySettings,
          onUpdate,
          new AbortController().signal,
          enhancedHistory,
          agent.modelId
        );
        return;
      }

      // 否则使用普通响应
      const response = await this.callAI(
        message,
        provider,
        proxySettings,
        enhancedHistory,
        agent.modelId,
        false
      );

      return {
        id: Date.now().toString(),
        content: response,
        role: 'assistant',
        timestamp: new Date()
      };
    } catch (error) {
      logService.error(`Agent发送消息失败: ${error instanceof Error ? error.message : '未知错误'}`, error);
      return {
        id: Date.now().toString(),
        content: `与Agent通信时出错: ${error instanceof Error ? error.message : '未知错误'}`,
        role: 'assistant',
        timestamp: new Date()
      };
    }
  }

  /**
   * 获取可用的AI提供商列表
   */
  getAvailableProviders(): AIProvider[] {
    return storageService.getProviders();
  }

  /**
   * 发送场景消息
   * 处理多Agent交互场景中的消息流转
   */
  async sendSceneMessage(
    sceneId: string,
    sessionId: string,
    content: string,
    participantId: string = 'user', // 默认为用户消息
    onAgentResponse?: (participantId: string, content: string, done: boolean, error?: boolean) => void
  ): Promise<SceneMessage[]> {
    try {
      // 获取场景信息
      const scene = storageService.getScene(sceneId);
      if (!scene) {
        throw new Error(`找不到场景: ${sceneId}`);
      }

      // 获取场景会话
      let session = storageService.getSceneSession(sessionId);
      if (!session) {
        // 如果会话不存在，创建新会话
        session = {
          id: sessionId,
          sceneId,
          name: `${scene.name} 会话 ${new Date().toLocaleString()}`,
          messages: [],
          createdAt: new Date(),
          updatedAt: new Date(),
          isActive: true
        };
      }

      // 添加用户消息
      const userMessage: SceneMessage = {
        id: Date.now().toString(),
        participantId,
        role: participantId === 'user' ? 'user' : 'agent',
        content,
        timestamp: new Date()
      };
      
      session.messages.push(userMessage);
      session.updatedAt = new Date();
      storageService.saveSceneSession(session);

      // 如果是用户消息，需要触发所有参与者的回复
      if (participantId === 'user') {
        const newMessages: SceneMessage[] = [userMessage];
        
        // 按照顺序（如果有）获取参与者
        const participants = [...scene.participants].sort((a, b) => 
          (a.order || Infinity) - (b.order || Infinity)
        );
        
        // 依次让每个参与者回复
        for (const participant of participants) {
          try {
            const agent = storageService.getAgent(participant.agentId);
            if (!agent) {
              continue;
            }
            
            // 构建完整的上下文提示词
            const combinedPrompt = this.buildAgentScenePrompt(scene, participant, agent);
            
            // 构建消息历史
            const messageHistory = this.buildSceneMessageHistory(scene, session, participant);
            
            // 发送消息给当前Agent
            const agentMessage = await this.processAgentInScene(
              combinedPrompt,
              messageHistory,
              agent,
              participant,
              (content, done, error) => {
                if (onAgentResponse) {
                  onAgentResponse(participant.id, content, done, error);
                }
              }
            );
            
            // 添加Agent回复到会话
            const agentSceneMessage: SceneMessage = {
              id: Date.now().toString(),
              participantId: participant.id,
              agentId: participant.agentId,
              role: 'agent',
              content: agentMessage.content,
              timestamp: new Date(),
              metadata: {
                agentName: agent.name,
                role: participant.role
              }
            };
            
            session.messages.push(agentSceneMessage);
            newMessages.push(agentSceneMessage);
            
            // 更新会话
            session.updatedAt = new Date();
            storageService.saveSceneSession(session);
          } catch (error) {
            logService.error(`场景 ${scene.name} 中Agent ${participant.role} 处理消息失败:`, error);
            
            // 添加错误消息
            const errorMessage: SceneMessage = {
              id: Date.now().toString(),
              participantId: participant.id,
              agentId: participant.agentId,
              role: 'agent',
              content: `处理消息时发生错误: ${error instanceof Error ? error.message : '未知错误'}`,
              timestamp: new Date(),
              metadata: {
                error: true
              }
            };
            
            session.messages.push(errorMessage);
            newMessages.push(errorMessage);
            
            // 更新会话
            session.updatedAt = new Date();
            storageService.saveSceneSession(session);
          }
        }
        
        return newMessages;
      }
      
      return [userMessage];
    } catch (error) {
      logService.error('场景消息处理错误:', error);
      throw error;
    }
  }
  
  /**
   * 构建Agent在场景中使用的提示词
   */
  private buildAgentScenePrompt(scene: Scene, participant: SceneParticipant, agent: Agent): string {
    // 组合场景背景、参与者角色和Agent基础系统提示词
    let prompt = `## 场景背景\n${scene.scenarioPrompt}\n\n`;
    
    prompt += `## 你的角色\n你是"${participant.role}"。\n${participant.contextPrompt}\n\n`;
    
    if (participant.interactionRules) {
      prompt += `## 交互规则\n${participant.interactionRules}\n\n`;
    }
    
    prompt += `## 基础指令\n${agent.systemPrompt}`;
    
    return prompt;
  }
  
  /**
   * 构建场景消息历史
   */
  private buildSceneMessageHistory(
    scene: Scene, 
    session: { messages: SceneMessage[] }, 
    currentParticipant: SceneParticipant
  ): { role: 'user' | 'assistant'; content: string; }[] {
    const history: { role: 'user' | 'assistant'; content: string; }[] = [];
    const messages = [...session.messages]; // 创建副本以免修改原始数据
    
    // 将场景消息转换为标准的历史记录格式
    for (const message of messages) {
      // 角色确定：
      // 1. 当前参与者的消息是assistant
      // 2. 其他消息是user
      const role = message.participantId === currentParticipant.id ? 'assistant' : 'user';
      
      // 添加发送者标识，除非是当前参与者自己的消息
      let content = message.content;
      if (role === 'user') {
        // 查找发送者的角色名称
        let sender = '用户';
        if (message.participantId !== 'user') {
          const senderParticipant = scene.participants.find(p => p.id === message.participantId);
          if (senderParticipant) {
            sender = senderParticipant.role;
          }
        }
        content = `[${sender}]: ${content}`;
      }
      
      history.push({ role, content });
    }
    
    return history;
  }
  
  /**
   * 在场景中处理Agent的响应
   */
  private async processAgentInScene(
    systemPrompt: string,
    messageHistory: { role: 'user' | 'assistant'; content: string; }[],
    agent: Agent,
    participant: SceneParticipant,
    onUpdate?: (content: string, done: boolean, error?: boolean) => void
  ): Promise<Message> {
    try {
      // 查找提供商和模型
      const provider = storageService.getProviders().find(p => p.id === agent.providerId);
      if (!provider) {
        throw new Error(`找不到提供商: ${agent.providerId}`);
      }
      
      const modelId = agent.modelId;
      
      // 获取最后一条用户消息
      const lastUserMsg = [...messageHistory].reverse().find(msg => msg.role === 'user');
      if (!lastUserMsg) {
        throw new Error('没有找到用户消息');
      }
      
      const proxySettings = storageService.getProxySettings();
      
      // 准备API请求选项
      const message = lastUserMsg.content;
      
      // 非流式调用
      let response = "";
      
      if (onUpdate) {
        // 流式调用
        await this.streamCallWithSystemPrompt(
          message,
          systemPrompt,
          provider,
          proxySettings,
          (content, done, error) => {
            onUpdate(content, done, error);
            if (done && !error) {
              response = content;
            }
          },
          messageHistory.slice(0, -1), // 不包括最后一条用户消息
          modelId
        );
      } else {
        // 非流式调用
        response = await this.callWithSystemPrompt(
          message,
          systemPrompt,
          provider,
          proxySettings,
          messageHistory.slice(0, -1),
          modelId
        );
      }
      
      return {
        id: Date.now().toString(),
        content: response,
        role: 'assistant',
        timestamp: new Date()
      };
    } catch (error) {
      logService.error(`场景中Agent ${participant.role} 处理消息失败:`, error);
      return {
        id: Date.now().toString(),
        content: `处理消息时发生错误: ${error instanceof Error ? error.message : '未知错误'}`,
        role: 'assistant',
        timestamp: new Date()
      };
    }
  }
  
  /**
   * 使用系统提示词调用AI
   */
  private async callWithSystemPrompt(
    message: string,
    systemPrompt: string,
    provider: AIProvider,
    proxySettings: ProxySettings,
    history?: { role: 'user' | 'assistant'; content: string }[],
    modelId?: string
  ): Promise<string> {
    // 这里简化实现，复用现有方法
    // 实际实现可能需要根据不同模型支持系统提示词的方式进行调整
    return this.callAI(
      message,
      provider,
      proxySettings,
      history,
      modelId,
      false,
      systemPrompt
    );
  }
  
  /**
   * 流式使用系统提示词调用AI
   */
  private async streamCallWithSystemPrompt(
    message: string,
    systemPrompt: string,
    provider: AIProvider,
    proxySettings: ProxySettings,
    onUpdate: (content: string, done: boolean, error?: boolean, reasoningContent?: string) => void,
    history?: { role: 'user' | 'assistant'; content: string }[],
    modelId?: string
  ): Promise<void> {
    // 创建新的AbortController
    if (this.currentStreamController) {
      this.currentStreamController.abort();
    }
    this.currentStreamController = new AbortController();
    
    try {
      await this.streamCallAI(
        message,
        provider,
        proxySettings,
        onUpdate,
        this.currentStreamController.signal,
        history,
        modelId,
        systemPrompt
      );
    } catch (error) {
      if (error instanceof Error && error.name === 'AbortError') {
        onUpdate('生成已被中断', true, true);
      } else {
        onUpdate(`发生错误: ${error instanceof Error ? error.message : '未知错误'}`, true, true);
      }
    } finally {
      this.currentStreamController = null;
    }
  }
}

// 导出单例
export const aiService = new AIService(); 