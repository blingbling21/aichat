/**
 * 聊天消息类型定义
 */
export type Message = {
  id: string;
  content: string;
  role: 'user' | 'assistant';
  timestamp: Date;
};

/**
 * AI提供商类型定义
 */
export type AIProvider = {
  id: string;
  name: string;
  apiEndpoint: string;
  apiKey: string;
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