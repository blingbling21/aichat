/**
 * 聊天消息类型定义
 */
export type Message = {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
  streaming?: boolean; // 标记消息是否正在流式返回中
  canceled?: boolean; // 标记消息是否被取消生成
};

/**
 * AI模型类型定义
 */
export type AIModel = {
  id: string;
  name: string;
  // 模型特有的参数设置，如temperature, top_p等
  parameters?: Record<string, number | string | boolean>;
};

/**
 * AI提供商类型定义
 */
export type AIProvider = {
  id: string;
  name: string;
  apiEndpoint: string;
  apiKey: string;
  // 提供商支持的模型列表
  models: AIModel[];
  // 当前选中的默认模型ID
  defaultModelId?: string;
};

/**
 * 代理设置类型定义
 */
export type ProxySettings = {
  enabled: boolean;
  host: string;
  port: string;
  requiresAuth: boolean;
  username: string;
  password: string;
}; 