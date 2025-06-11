import { AIProvider, APIAutoFetchConfig, AIModel, APIHeaderConfig } from '../types';
import { logService } from './log';
import { httpService } from './http';
import { storageService } from './storage';

/**
 * API自动获取服务
 * 用于从AI提供商API自动获取模型列表和费用信息
 */
class APIAutoFetchService {
  
  /**
   * 从指定路径提取值
   */
  private extractValueFromPath(obj: Record<string, unknown>, path: string): unknown {
    if (!path || !obj) return obj;
    
    const keys = path.split('.');
    let value: unknown = obj;
    
    for (const key of keys) {
      if (key.includes('[') && key.includes(']')) {
        // 处理数组索引，如 "data[0]"
        const arrayKey = key.split('[')[0];
        const index = parseInt(key.split('[')[1].split(']')[0]);
        const arrayValue = (value as Record<string, unknown>)[arrayKey];
        value = Array.isArray(arrayValue) ? arrayValue[index] : undefined;
      } else {
        value = (value as Record<string, unknown>)[key];
      }
      
      if (value === undefined || value === null) {
        return undefined;
      }
    }
    
    return value;
  }

  /**
   * 构建请求头
   */
  private buildHeaders(headerConfigs: APIHeaderConfig[] = [], apiKey?: string): Record<string, string> {
    const headers: Record<string, string> = {};
    
    for (const config of headerConfigs) {
      let value: string;
      
      // 向后兼容：如果没有valueType字段，检查valueTemplate是否存在
      if ((config.valueType === 'template' || (!config.valueType && config.valueTemplate)) && config.valueTemplate) {
        value = config.valueTemplate.replace('{apiKey}', apiKey || '');
      } else {
        value = config.value || '';
      }
      
      if (value) {
        headers[config.key] = value;
      }
    }
    
    return headers;
  }

  /**
   * 发送HTTP请求（支持代理）
   */
  private async makeRequest(
    endpoint: string,
    method: 'GET' | 'POST',
    headers: Record<string, string>
  ): Promise<Record<string, unknown>> {
    try {
      // 获取代理设置
      const proxySettings = storageService.getProxySettings();
      
      // 使用httpService发送请求（支持代理）
      const response = await httpService.sendRequest(endpoint, {
        method,
        headers: {
          'Content-Type': 'application/json',
          ...headers,
        },
        proxySettings: proxySettings.enabled ? proxySettings : undefined
      });

      if (!response.success) {
        throw new Error(`HTTP ${response.status}: ${response.body}`);
      }

      return JSON.parse(response.body);
    } catch (error) {
      logService.error(`API请求失败: ${endpoint}`, error);
      throw error;
    }
  }

  /**
   * 获取模型列表
   */
  async fetchModels(provider: AIProvider): Promise<AIModel[]> {
    const config = provider.autoFetchConfig?.modelsApi;
    
    if (!config?.enabled || !config.endpoint) {
      throw new Error('模型API配置未启用或端点为空');
    }

    logService.info(`开始从API获取模型列表: ${provider.name}`);

    try {
      // 处理endpoint中的模板变量
      let endpoint = config.endpoint;
      if (endpoint.includes('{apiKey}') && provider.apiKey) {
        endpoint = endpoint.replace('{apiKey}', provider.apiKey);
      }
      
      // 构建请求头
      const headers = this.buildHeaders(config.headers, provider.apiKey);
      
      // 发送请求
      const response = await this.makeRequest(endpoint, config.method || 'GET', headers);
      
      // 提取模型列表
      const modelsData = config.responsePath 
        ? this.extractValueFromPath(response, config.responsePath)
        : response;

      if (!Array.isArray(modelsData)) {
        throw new Error('API响应中的模型数据不是数组格式');
      }

      // 转换为AIModel格式
      const models: AIModel[] = [];
      
      for (const modelData of modelsData) {
        const modelId = this.extractValueFromPath(modelData as Record<string, unknown>, config.modelIdPath || 'id');
        
        if (!modelId) {
          logService.warn('跳过无ID的模型');
          continue;
        }

        // 过滤模型
        if (config.filterPattern) {
          const regex = new RegExp(config.filterPattern);
          if (!regex.test(String(modelId))) {
            logService.debug(`过滤掉模型: ${modelId} (不匹配 ${config.filterPattern})`);
            continue;
          }
        }

        const model: AIModel = {
          id: String(modelId),
          // 如果有名称路径则使用，否则使用ID作为名称
          ...(config.modelNamePath && {
            name: String(this.extractValueFromPath(modelData as Record<string, unknown>, config.modelNamePath) || modelId)
          }),
          // 如果有描述路径则添加描述
          ...(config.modelDescriptionPath && {
            description: String(this.extractValueFromPath(modelData as Record<string, unknown>, config.modelDescriptionPath) || '')
          }),
          features: {
            reasoning: false,
            image: false,
            video: false,
            voice: false
          }
        };

        // 特殊处理：对于Gemini模型，移除模型ID中的"models/"前缀，避免API URL重复
        if (String(modelId).startsWith('models/')) {
          const originalId = model.id;
          model.id = String(modelId).replace('models/', '');
          logService.info(`Gemini模型ID转换: ${originalId} -> ${model.id}`);
        }

        models.push(model);
      }

      logService.info(`成功获取 ${models.length} 个模型: ${provider.name}`);
      return models;

    } catch (error) {
      logService.error(`获取模型列表失败: ${provider.name}`, error);
      throw error;
    }
  }

  /**
   * 获取定价信息
   */
  async fetchPricing(provider: AIProvider): Promise<Record<string, unknown>> {
    const config = provider.autoFetchConfig?.pricingApi;
    
    if (!config?.enabled || !config.endpoint) {
      throw new Error('定价API配置未启用或端点为空');
    }

    logService.info(`开始从API获取定价信息: ${provider.name}`);

    try {
      // 处理endpoint中的模板变量
      let endpoint = config.endpoint;
      if (endpoint.includes('{apiKey}') && provider.apiKey) {
        endpoint = endpoint.replace('{apiKey}', provider.apiKey);
      }
      
      // 构建请求头
      const headers = this.buildHeaders(config.headers, provider.apiKey);
      
      // 发送请求
      const response = await this.makeRequest(endpoint, config.method || 'GET', headers);
      
      // 提取定价数据
      const pricingData = config.responsePath 
        ? this.extractValueFromPath(response, config.responsePath)
        : response;

      logService.info(`成功获取定价信息: ${provider.name}`);
      return pricingData as Record<string, unknown>;

    } catch (error) {
      logService.error(`获取定价信息失败: ${provider.name}`, error);
      throw error;
    }
  }

  /**
   * 获取账户余额信息
   */
  async fetchBalance(provider: AIProvider): Promise<Record<string, unknown>> {
    const config = provider.autoFetchConfig?.balanceApi;
    
    if (!config?.enabled || !config.endpoint) {
      throw new Error('余额API配置未启用或端点为空');
    }

    logService.info(`开始从API获取账户余额: ${provider.name}`);

    try {
      // 处理endpoint中的模板变量
      let endpoint = config.endpoint;
      if (endpoint.includes('{apiKey}') && provider.apiKey) {
        endpoint = endpoint.replace('{apiKey}', provider.apiKey);
      }
      
      // 构建请求头
      const headers = this.buildHeaders(config.headers, provider.apiKey);
      
      // 发送请求
      const response = await this.makeRequest(endpoint, config.method || 'GET', headers);
      
      // 提取余额数据
      const balanceData = config.responsePath 
        ? this.extractValueFromPath(response, config.responsePath)
        : response;

      // 提取具体的余额信息
      const result: Record<string, unknown> = { raw: balanceData };
      
      // 如果有动态字段配置，使用动态配置
      if (config.responseFields && config.responseFields.length > 0) {
        config.responseFields.forEach(field => {
          if (field.fieldPath) {
            result[field.fieldPath] = this.extractValueFromPath(response, field.fieldPath);
          }
        });
      } else {
        // 向后兼容：使用固定字段配置
        if (config.balanceInfoPath) {
          result.balance = this.extractValueFromPath(response, config.balanceInfoPath);
        }
        
        if (config.currencyPath) {
          result.currency = this.extractValueFromPath(response, config.currencyPath);
        }
        
        if (config.availablePath) {
          result.isAvailable = this.extractValueFromPath(response, config.availablePath);
        }
      }

      logService.info(`成功获取账户余额: ${provider.name} - 余额: ${result.balance} ${result.currency}`);
      return result;

    } catch (error) {
      logService.error(`获取账户余额失败: ${provider.name}`, error);
      throw error;
    }
  }

  /**
   * 检查是否需要自动更新
   */
  shouldAutoUpdate(provider: AIProvider): boolean {
    const autoUpdate = provider.autoFetchConfig?.autoUpdate;
    
    if (!autoUpdate?.enabled) {
      return false;
    }

    if (!autoUpdate.lastUpdateTime) {
      return true; // 从未更新过
    }

    const intervalMs = (autoUpdate.intervalHours || 24) * 60 * 60 * 1000;
    const timeSinceUpdate = Date.now() - autoUpdate.lastUpdateTime.getTime();
    
    return timeSinceUpdate >= intervalMs;
  }

  /**
   * 更新提供商的最后更新时间
   */
  updateLastUpdateTime(provider: AIProvider): AIProvider {
    if (!provider.autoFetchConfig) {
      provider.autoFetchConfig = {};
    }
    
    if (!provider.autoFetchConfig.autoUpdate) {
      provider.autoFetchConfig.autoUpdate = { enabled: false };
    }

    provider.autoFetchConfig.autoUpdate.lastUpdateTime = new Date();
    
    return provider;
  }

  /**
   * 获取预设的API配置模板
   */
  getPresetConfigs(): Record<string, Partial<APIAutoFetchConfig>> {
    return {
      openai: {
        modelsApi: {
          enabled: true,
          endpoint: 'https://api.openai.com/v1/models',
          method: 'GET',
          headers: [
            {
              key: 'Authorization',
              value: '',
              valueTemplate: 'Bearer {apiKey}',
              valueType: 'template'
            }
          ],
          responsePath: 'data',
          modelIdPath: 'id',
          modelNamePath: 'id',
          filterPattern: '^(gpt-|text-|davinci|curie|babbage|ada)'
        },
        autoUpdate: {
          enabled: true,
          intervalHours: 24
        }
      },
      
      gemini: {
        modelsApi: {
          enabled: true,
          endpoint: 'https://generativelanguage.googleapis.com/v1beta/models?key={apiKey}',
          method: 'GET',
          headers: [],
          responsePath: 'models',
          modelIdPath: 'name',
          modelNamePath: 'displayName',
          modelDescriptionPath: 'description',
          filterPattern: '^models/(gemini-|chat-|text-)'
        },
        autoUpdate: {
          enabled: true,
          intervalHours: 24
        }
      },
      
      deepseek: {
        modelsApi: {
          enabled: true,
          endpoint: 'https://api.deepseek.com/models',
          method: 'GET',
          headers: [
            {
              key: 'Authorization',
              value: '',
              valueTemplate: 'Bearer {apiKey}',
              valueType: 'template'
            }
          ],
          responsePath: 'data',
          modelIdPath: 'id',
          modelNamePath: 'id',
          filterPattern: '^deepseek-'
        },
        autoUpdate: {
          enabled: true,
          intervalHours: 24
        }
      },
      
      anthropic: {
        // Claude/Anthropic的API通常不提供公开的模型列表接口
        modelsApi: {
          enabled: false,
          endpoint: '',
          method: 'GET'
        },
        autoUpdate: {
          enabled: false
        }
      }
    };
  }
}

export const apiAutoFetchService = new APIAutoFetchService(); 