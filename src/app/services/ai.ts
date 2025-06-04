import { AIProvider, Message, ProxySettings, Agent, SceneParticipant, SceneMessage, Scene, CustomAPIConfig, APIBodyFieldConfig, APIResponseConfig } from '../types';
import { storageService } from './storage';
import { logService } from './log';

/**
 * AI响应结果类型
 */
type AIResponse = {
  content: string;
  reasoningContent?: string;
};

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
    modelId?: string,
    temperature?: number
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
      const response = await this.callAIWithReasoning(message, provider, proxySettings, history, actualModelId, false, undefined, temperature);
      
      return {
        id: Date.now().toString(),
        content: response.content,
        role: 'assistant',
        timestamp: new Date(),
        reasoningContent: response.reasoningContent
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
   * @param temperature 温度参数
   */
  async sendMessageStream(
    message: string,
    onUpdate: (content: string, done: boolean, error?: boolean, reasoningContent?: string) => void,
    providerId?: string,
    history?: { role: 'user' | 'assistant'; content: string }[],
    modelId?: string,
    temperature?: number
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
        actualModelId,
        temperature
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
   * 根据自定义配置构建API请求
   */
  private buildCustomAPIRequest(
    config: CustomAPIConfig,
    provider: AIProvider, 
    message: string,
    history?: { role: 'user' | 'assistant'; content: string }[],
    modelId?: string,
    systemPrompt?: string,
    isStream?: boolean,
    temperature?: number
  ): { url: string; options: RequestInit } {
    logService.info(`buildCustomAPIRequest被调用，bodyFields数量: ${config.bodyFields.length}`);
    
    // 专门记录温度参数
    if (temperature !== undefined) {
      logService.info(`⚡ 温度参数传递: ${temperature}`);
    } else {
      logService.info(`⚡ 温度参数未设置，将使用默认值`);
    }
    
    const options: RequestInit = {
      method: config.method,
      headers: {
        'Content-Type': config.contentType,
      },
    };

    // 构建请求头
    const headers: Record<string, string> = {
      'Content-Type': config.contentType,
    };

    for (const headerConfig of config.headers) {
      let headerValue: string = headerConfig.value;
      
      // 处理模板
      if (headerConfig.valueTemplate) {
        const templateResult = this.processTemplate(headerConfig.valueTemplate, {
          apiKey: provider.apiKey,
          model: modelId,
          endpoint: provider.apiEndpoint
        });
        headerValue = String(templateResult);
      }
      
      headers[headerConfig.key] = headerValue;
    }

    options.headers = headers;

    // 构建请求体
    if (config.method === 'POST' || config.method === 'PUT') {
      const body: Record<string, unknown> = {};
      
      logService.info(`开始构建请求体，字段数量: ${config.bodyFields.length}`);
      
      for (const fieldConfig of config.bodyFields) {
        logService.info(`处理字段: ${fieldConfig.path}, 类型: ${fieldConfig.valueType}`);
        
        const value = this.buildFieldValue(fieldConfig, {
          message,
          history,
          modelId,
          systemPrompt,
          isStream,
          provider,
          temperature: temperature
        });
        
        if (value !== undefined && value !== null) {
          this.setNestedValue(body, fieldConfig.path, value);
          logService.info(`✓ 字段 ${fieldConfig.path} 已设置`);
          } else {
          logService.error(`✗ 字段 ${fieldConfig.path} 值为空`);
        }
      }
      
      logService.info(`请求体字段: ${Object.keys(body).join(', ')}`);
      options.body = JSON.stringify(body);
    }

    return {
      url: provider.apiEndpoint,
      options
    };
  }

  /**
   * 处理模板字符串，支持类型转换
   */
  private processTemplate(template: string, variables: Record<string, unknown>): unknown {
    let result = template;
    
    for (const [key, value] of Object.entries(variables)) {
      const regex = new RegExp(`\\{${key}\\}`, 'g');
      result = result.replace(regex, String(value || ''));
    }
    
    // 特殊处理：如果整个模板就是一个变量，进行类型转换
    if (template.match(/^\{[^}]+\}$/)) {
      const varName = template.slice(1, -1); // 去掉大括号
      const varValue = variables[varName];
      
      // 特殊处理：model字段总是返回字符串
      if (varName === 'model') {
        return String(varValue || '');
      }
      
      // 特殊处理：stream字段返回布尔值
      if (varName === 'stream') {
        if (typeof varValue === 'boolean') {
          return varValue;
        }
        if (varValue === 'true') return true;
        if (varValue === 'false') return false;
        return Boolean(varValue);
      }
      
      // 其他字段：如果是布尔值，返回布尔类型
      if (typeof varValue === 'boolean') {
        return varValue;
      }
      
      // 其他字段：如果是数字，返回数字类型（除了看起来像ID的）
      if (typeof varValue === 'number') {
        // 如果数字很大（像时间戳），可能是ID，转为字符串
        if (varValue > 1000000000) {
          return String(varValue);
        }
        return varValue;
      }
      
      // 特殊处理字符串形式的布尔值
      if (varValue === 'true') return true;
      if (varValue === 'false') return false;
      
      // 特殊处理字符串形式的数字（小数字才转换）
      if (typeof varValue === 'string' && !isNaN(Number(varValue)) && varValue.trim() !== '' && Number(varValue) < 1000000000) {
        return Number(varValue);
      }
    }
    
    return result;
  }

  /**
   * 构建字段值
   */
  private buildFieldValue(
    fieldConfig: APIBodyFieldConfig,
    context: {
      message: string;
      history?: { role: 'user' | 'assistant'; content: string }[];
      modelId?: string;
      systemPrompt?: string;
      isStream?: boolean;
      provider: AIProvider;
      temperature?: number;
    }
  ): unknown {
    switch (fieldConfig.valueType) {
      case 'static':
        return fieldConfig.value;
        
      case 'template':
        if (!fieldConfig.valueTemplate) return '';
        const templateResult = this.processTemplate(fieldConfig.valueTemplate, {
          message: context.message,
          model: context.modelId,
          stream: context.isStream,
          apiKey: context.provider.apiKey,
          systemPrompt: context.systemPrompt,
          temperature: context.temperature || 0.7
        });
        
        // 特殊日志：如果是stream字段，记录详细信息
        if (fieldConfig.path === 'stream') {
          logService.info(`Stream字段处理: 模板="${fieldConfig.valueTemplate}", context.isStream=${context.isStream}, 结果=${templateResult}`);
        }
        
        // 特殊日志：如果是温度字段，记录详细信息
        if (fieldConfig.path.toLowerCase().includes('temperature')) {
          logService.info(`Temperature字段处理: 模板="${fieldConfig.valueTemplate}", context.temperature=${context.temperature}, 结果=${templateResult}`);
        }
        
        return templateResult;
        
      case 'dynamic':
        // 处理动态值，如构建消息数组
        if (fieldConfig.path === 'messages') {
          logService.debug('开始构建动态messages字段');
          const messages: { role: string; content: string }[] = [];
          
          // 添加系统提示词
          if (context.systemPrompt) {
          messages.push({
            role: 'system',
              content: context.systemPrompt
            });
            logService.debug('添加了系统提示词消息');
          }
          
          // 添加历史消息（注意：history中已经包含了当前用户消息，不需要单独添加）
          if (context.history) {
            messages.push(...context.history);
            logService.debug(`添加了 ${context.history.length} 条历史消息（包含当前消息）`);
            // 详细记录每条历史消息
            context.history.forEach((msg, index) => {
              logService.info(`历史消息[${index}] ${msg.role}: ${msg.content.substring(0, 100)}${msg.content.length > 100 ? '...' : ''}`);
            });
          } else {
            // 如果没有历史记录，则添加当前消息
            messages.push({
          role: 'user',
              content: context.message
            });
            logService.debug('没有历史记录，添加了当前用户消息');
            logService.info(`当前消息: ${context.message}`);
          }
          
          logService.debug(`动态messages字段最终包含 ${messages.length} 条消息`);
          logService.info('=== 发送给AI的完整消息历史 ===');
          messages.forEach((msg, index) => {
            logService.info(`消息[${index}] ${msg.role}: ${msg.content}`);
          });
          logService.info('=== 消息历史结束 ===');
          
          return messages;
        }
        
        logService.debug(`处理其他动态字段: ${fieldConfig.path}`);
        // 其他动态值处理...
        return fieldConfig.value;
        
      default:
        return fieldConfig.value;
    }
  }

  /**
   * 设置嵌套对象值
   */
  private setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
    const keys = path.split('.');
    let current: Record<string, unknown> = obj;
    
    for (let i = 0; i < keys.length - 1; i++) {
      const key = keys[i];
      if (!(key in current)) {
        current[key] = {};
      }
      current = current[key] as Record<string, unknown>;
    }
    
    current[keys[keys.length - 1]] = value;
  }

  /**
   * 从响应中提取内容
   */
  private extractResponseContent(response: unknown, config: APIResponseConfig): string {
    const result = this.getNestedValue(response, config.contentPath);
    return result ? String(result) : '';
  }

  /**
   * 获取嵌套对象值
   */
  private getNestedValue(obj: unknown, path: string): unknown {
    const keys = path.split('.');
    let current = obj;
    
    for (const key of keys) {
      if (key.includes('[') && key.includes(']')) {
        // 处理数组索引，如 choices[0]
        const arrayKey = key.substring(0, key.indexOf('['));
        const index = parseInt(key.substring(key.indexOf('[') + 1, key.indexOf(']')));
        
        if (current && typeof current === 'object' && current !== null && arrayKey in current) {
          const array = (current as Record<string, unknown>)[arrayKey];
          if (Array.isArray(array)) {
            current = array[index];
          } else {
            return null;
          }
        } else {
          return null;
        }
      } else {
        if (current && typeof current === 'object' && current !== null && key in current) {
          current = (current as Record<string, unknown>)[key];
        } else {
          return null;
        }
      }
    }
    
    return current;
  }

  /**
   * 通用API调用（使用自定义配置）
   */
  private async callCustomAPI(
    message: string,
    provider: AIProvider,
    proxySettings: ProxySettings,
    history?: { role: 'user' | 'assistant'; content: string }[],
    modelId?: string,
    isStream: boolean = false,
    systemPrompt?: string,
    temperature?: number
  ): Promise<AIResponse> {
    if (!provider.customConfig) {
      throw new Error('提供商缺少自定义API配置');
    }

    const { url, options } = this.buildCustomAPIRequest(
      provider.customConfig,
      provider,
      message,
      history,
      modelId,
      systemPrompt,
      isStream,
      temperature
    );

    logService.info(`调用自定义API: ${provider.name}, 流式模式: ${isStream}`);
    logService.debug(`请求URL: ${url}`);
    logService.debug(`请求选项: ${JSON.stringify(options, null, 2)}`);

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `API错误: ${response.status} - ${errorText}`;
      
      // 尝试使用自定义错误解析
      if (provider.customConfig.response.errorConfig?.messagePath) {
        try {
          const errorData = JSON.parse(errorText);
          const customError = this.getNestedValue(errorData, provider.customConfig.response.errorConfig.messagePath);
          if (customError) {
            errorMessage = `API错误: ${customError}`;
          }
        } catch {
          // 忽略解析错误，使用默认错误信息
        }
      }
      
      throw new Error(errorMessage);
    }

    const data = await response.json();
    logService.info(`收到非流式响应: ${JSON.stringify(data)}`);
    
    const extractedContent = this.extractResponseContent(data, provider.customConfig.response);
    logService.info(`提取的内容: "${extractedContent}"`);
    
    // 提取推理内容（如果配置了）
    let reasoningContent: string | undefined;
    if (provider.customConfig.response.reasoningPath) {
      const extractedReasoning = this.getNestedValue(data, provider.customConfig.response.reasoningPath);
      if (extractedReasoning) {
        reasoningContent = String(extractedReasoning);
        logService.info(`提取的推理内容: "${reasoningContent}"`);
      }
    }
    
    return {
      content: extractedContent,
      reasoningContent
    };
  }

  /**
   * 修改后的callAI方法，强制使用自定义配置
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
    logService.info(`callAI被调用，提供商: ${provider.name}，模型: ${modelId}`);
    
    // 检查是否有自定义配置
    if (!provider.customConfig) {
      logService.error(`提供商 ${provider.name} 缺少自定义API配置`);
      throw new Error(`提供商 ${provider.name} 尚未完成API配置。

请按以下步骤操作：
1. 进入"设置"页面
2. 找到 ${provider.name} 提供商
3. 点击"高级"按钮
4. 根据 ${provider.name} 的API文档完成配置
5. 保存配置后即可使用

系统不再提供预设配置，需要您完全自主配置所有API参数。`);
    }
    
    logService.info(`找到自定义配置，bodyFields数量: ${provider.customConfig.bodyFields.length}`);
    logService.info(`调用自定义配置API: ${provider.name}`);
    return this.callCustomAPI(message, provider, proxySettings, history, modelId, isStream, systemPrompt).then(response => response.content);
  }

  /**
   * 调用AI并返回完整响应（包含推理内容）
   */
  private async callAIWithReasoning(
    message: string, 
    provider: AIProvider, 
    proxySettings: ProxySettings,
    history?: { role: 'user' | 'assistant'; content: string }[],
    modelId?: string,
    isStream: boolean = false,
    systemPrompt?: string,
    temperature?: number
  ): Promise<AIResponse> {
    logService.info(`callAIWithReasoning被调用，提供商: ${provider.name}，模型: ${modelId}`);
    
    // 检查是否有自定义配置
    if (!provider.customConfig) {
      logService.error(`提供商 ${provider.name} 缺少自定义API配置`);
      throw new Error(`提供商 ${provider.name} 尚未完成API配置。

请按以下步骤操作：
1. 进入"设置"页面
2. 找到 ${provider.name} 提供商
3. 点击"高级"按钮
4. 根据 ${provider.name} 的API文档完成配置
5. 保存配置后即可使用

系统不再提供预设配置，需要您完全自主配置所有API参数。`);
    }
    
    logService.info(`找到自定义配置，bodyFields数量: ${provider.customConfig.bodyFields.length}`);
    logService.info(`调用自定义配置API: ${provider.name}`);
    return this.callCustomAPI(message, provider, proxySettings, history, modelId, isStream, systemPrompt, temperature);
  }
  
  /**
   * 流式API调用，强制使用自定义配置
   */
  private async streamCallAI(
    message: string, 
    provider: AIProvider, 
    proxySettings: ProxySettings,
    onUpdate: (content: string, done: boolean, error?: boolean, reasoningContent?: string) => void,
    abortSignal: AbortSignal,
    history?: { role: 'user' | 'assistant'; content: string }[],
    modelId?: string,
    temperature?: number
  ): Promise<void> {
    logService.info(`streamCallAI被调用，提供商: ${provider.name}，模型: ${modelId}`);
    
    // 检查是否有自定义配置
    if (!provider.customConfig) {
      logService.error(`提供商 ${provider.name} 缺少自定义API配置`);
      throw new Error(`提供商 ${provider.name} 尚未完成API配置。

请按以下步骤操作：
1. 进入"设置"页面
2. 找到 ${provider.name} 提供商
3. 点击"高级"按钮
4. 根据 ${provider.name} 的API文档完成配置
5. 保存配置后即可使用

系统不再提供预设配置，需要您完全自主配置所有API参数。`);
    }

    logService.info(`找到自定义配置，bodyFields数量: ${provider.customConfig.bodyFields.length}`);
    logService.info(`使用自定义配置进行流式调用: ${provider.name}`);
    await this.streamCustomAPI(
      message, 
      provider, 
      proxySettings, 
      onUpdate, 
      abortSignal, 
      history, 
      modelId, 
      temperature
    );
  }
  
  /**
   * 测试API连接
   * 用于验证API设置是否正确，要求必须配置自定义API
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
      
      if (!provider.customConfig) {
        return { 
          success: false, 
          message: '请先配置自定义API参数才能测试连接' 
        };
      }
      
      if (!provider.apiKey) {
        return { 
          success: false, 
          message: 'API密钥未设置' 
        };
      }
      
      // 获取默认模型
      let testModelId = provider.defaultModelId;
        if (!testModelId && provider.models && provider.models.length > 0) {
          testModelId = provider.models[0].id;
        }
      
      if (!testModelId) {
        return { 
          success: false, 
          message: '请先添加至少一个模型' 
        };
      }
      
      const proxySettings = storageService.getProxySettings();
      
      // 测试消息
      const testMessage = "这是一条测试消息，请简短回复以验证连接正常。";
      
      logService.info(`测试连接 ${provider.name}，使用模型: ${testModelId}`);
      
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

      // 检查Agent是否启用流式模式，如果有消息更新回调，则使用Agent的流式设置
      const useStream = onUpdate && (agent.isStreamMode ?? true);

      if (useStream) {
        await this.streamCallAI(
          message,
          provider,
          proxySettings,
          onUpdate,
          new AbortController().signal,
          enhancedHistory,
          agent.modelId,
          agent.temperature
        );
        return;
      }

      // 否则使用普通响应
      const response = await this.callAIWithReasoning(
        message,
        provider,
        proxySettings,
        enhancedHistory,
        agent.modelId,
        false,
        undefined,
        agent.temperature
      );

      return {
        id: Date.now().toString(),
        content: response.content,
        reasoningContent: response.reasoningContent,
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
        undefined
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

  /**
   * 通用流式API调用（使用自定义配置）
   */
  private async streamCustomAPI(
    message: string,
    provider: AIProvider,
    proxySettings: ProxySettings,
    onUpdate: (content: string, done: boolean, error?: boolean, reasoningContent?: string) => void,
    abortSignal: AbortSignal,
    history?: { role: 'user' | 'assistant'; content: string }[],
    modelId?: string,
    temperature?: number
  ): Promise<void> {
    if (!provider.customConfig) {
      throw new Error('提供商缺少自定义API配置');
    }

    const { url, options } = this.buildCustomAPIRequest(
      provider.customConfig,
      provider,
      message,
      history,
      modelId,
      undefined,
      true, // 启用流式
      temperature
    );

    // 添加中断信号
    options.signal = abortSignal;

    logService.info(`使用自定义配置进行流式调用: ${provider.name}`);
    logService.debug(`请求URL: ${url}`);
    logService.debug(`请求选项: ${JSON.stringify(options, null, 2)}`);

    const response = await fetch(url, options);

    if (!response.ok) {
      const errorText = await response.text();
      let errorMessage = `API错误: ${response.status} - ${errorText}`;
      
      // 尝试使用自定义错误解析
      if (provider.customConfig.response.errorConfig?.messagePath) {
        try {
          const errorData = JSON.parse(errorText);
          const customError = this.getNestedValue(errorData, provider.customConfig.response.errorConfig.messagePath);
          if (customError) {
            errorMessage = `API错误: ${customError}`;
          }
        } catch {
          // 忽略解析错误，使用默认错误信息
        }
      }
      
      throw new Error(errorMessage);
    }

    // 检查是否支持流式响应
    if (!provider.customConfig.response.streamConfig?.enabled) {
      // 如果不支持流式，直接返回完整响应
      const data = await response.json();
      const content = this.extractResponseContent(data, provider.customConfig.response);
      onUpdate(content, true, false);
      return;
    }

    // 处理流式响应
    if (!response.body) {
      throw new Error('响应不包含数据流');
    }

    const reader = response.body.getReader();
    const decoder = new TextDecoder('utf-8');
    
    let fullResponse = '';
    let reasoningFullResponse = '';
    const streamConfig = provider.customConfig.response.streamConfig;

    try {
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        
        // 解码数据块
        const chunk = decoder.decode(value, { stream: true });
        
        // 处理SSE格式数据
        const lines = chunk
          .split('\n')
          .filter(line => line.trim() !== '' && 
                  line.trim() !== `data: ${streamConfig.finishCondition || '[DONE]'}`);
        
        for (const line of lines) {
          const dataPrefix = streamConfig.dataPrefix || 'data: ';
          if (line.startsWith(dataPrefix)) {
            try {
              const jsonData = JSON.parse(line.slice(dataPrefix.length));
              
              // 提取增量内容
              const content = this.getNestedValue(jsonData, streamConfig.contentPath);
              if (content) {
                fullResponse += String(content);
                onUpdate(fullResponse, false);
              }
              
              // 提取推理内容（如果配置了）
              // 对于流式响应，优先使用流式配置的推理路径，因为结构不同（delta vs message）
              const reasoningPath = streamConfig.reasoningPath || provider.customConfig.response.reasoningPath;
              if (reasoningPath) {
                const reasoningContent = this.getNestedValue(jsonData, reasoningPath);
                if (reasoningContent) {
                  reasoningFullResponse += String(reasoningContent);
                  logService.debug(`收到推理内容: ${reasoningContent}`);
                  onUpdate(fullResponse, false, false, reasoningFullResponse);
                }
              }
            } catch (e) {
              console.error('解析自定义SSE数据错误:', e);
            }
          }
        }
      }
      
      // 流式传输完成
      onUpdate(fullResponse, true, false, reasoningFullResponse);
    } finally {
      reader.releaseLock();
    }
  }
}

// 导出单例
export const aiService = new AIService(); 