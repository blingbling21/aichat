import { AIProvider, Message, ProxySettings } from '../types';
import { storageService } from './storage';

/**
 * AI服务类
 * 用于处理与AI提供商的通信
 */
class AIService {
  /**
   * 发送消息到AI并获取回复
   */
  async sendMessage(
    message: string, 
    providerId?: string,
    history?: { role: 'user' | 'assistant'; content: string }[]
  ): Promise<Message> {
    try {
      // 获取选中的提供商
      const id = providerId || storageService.getSelectedProviderId();
      const providers = storageService.getProviders();
      const provider = providers.find(p => p.id === id);
      
      if (!provider) {
        throw new Error('找不到选中的AI提供商');
      }
      
      // 获取代理设置
      const proxySettings = storageService.getProxySettings();
      
      // 调用真实的API
      const response = await this.callAI(message, provider, proxySettings, history);
      
      return {
        id: Date.now().toString(),
        content: response,
        role: 'assistant',
        timestamp: new Date()
      };
    } catch (error) {
      console.error('AI服务错误:', error);
      return {
        id: Date.now().toString(),
        content: '发生错误，请检查网络连接或API设置。' + (error instanceof Error ? ` 错误信息: ${error.message}` : ''),
        role: 'assistant',
        timestamp: new Date()
      };
    }
  }
  
  /**
   * 真实的API调用
   */
  private async callAI(
    message: string, 
    provider: AIProvider, 
    proxySettings: ProxySettings,
    history?: { role: 'user' | 'assistant'; content: string }[]
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
    console.log('发送消息到:', provider.name);
    console.log('API端点:', provider.apiEndpoint);
    console.log('代理设置:', proxySettings.enabled ? '已启用' : '未启用');
    
    // 注意：在浏览器环境中，代理设置通常需要在服务器端处理
    // 或者使用特殊的代理配置扩展/中间件
    // 这里记录代理信息，但实际应用可能需要通过后端API转发请求
    if (proxySettings.enabled) {
      console.log('使用代理:', `${proxySettings.host}:${proxySettings.port}`);
      // 在Tauri应用中，可以考虑使用http客户端插件在Rust端处理代理
    }
    
    // 根据不同的AI提供商构建不同的请求体
    if (provider.name.toLowerCase().includes('openai') || provider.name.toLowerCase().includes('chatgpt')) {
      // OpenAI API格式
      options.body = JSON.stringify({
        model: 'gpt-3.5-turbo', // 可以从提供商配置中获取
        messages: [
          ...(history || []),
          {
            role: 'user',
            content: message
          }
        ],
        temperature: 0.7
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
        model: 'claude-2', // 可以从提供商配置中获取
        prompt: `\n\nHuman: ${message}\n\nAssistant:`,
        max_tokens_to_sample: 1000
      });
      
      const fetchResponse = await fetch(provider.apiEndpoint, options);
      
      if (!fetchResponse.ok) {
        const errorText = await fetchResponse.text();
        throw new Error(`Claude API错误: ${fetchResponse.status} - ${errorText}`);
      }
      
      const data = await fetchResponse.json();
      response = data.completion;
      
    } else {
      // 通用API格式处理
      // 假设格式为 { prompt: string }
      options.body = JSON.stringify({
        prompt: message
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
      
      const proxySettings = storageService.getProxySettings();
      
      // 测试消息
      const testMessage = "这是一条测试消息，请简短回复以验证连接正常。";
      
      // 发送测试请求
      const response = await this.callAI(testMessage, provider, proxySettings);
      
      return {
        success: true,
        message: `连接成功！收到回复: "${response.substring(0, 50)}${response.length > 50 ? '...' : ''}"`
      };
    } catch (error) {
      console.error('测试连接失败:', error);
      return {
        success: false,
        message: `连接失败: ${error instanceof Error ? error.message : '未知错误'}`
      };
    }
  }
  
  /**
   * 获取可用的AI提供商列表
   */
  getAvailableProviders(): AIProvider[] {
    return storageService.getProviders();
  }
}

// 导出单例
export const aiService = new AIService(); 