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
  reasoningContent?: string; // deepseek-reasoner模型的推理过程
  reasoningCollapsed?: boolean; // 推理内容是否折叠
};

/**
 * 模型支持的功能类型
 */
export type ModelFeatures = {
  reasoning: boolean; // 推理能力
  image: boolean;    // 图片生成/理解
  video: boolean;    // 视频生成/理解
  voice: boolean;    // 语音交互
};

/**
 * AI模型类型定义
 */
export type AIModel = {
  id: string;
  name: string;
  // 模型特有的参数设置，如temperature, top_p等
  parameters?: Record<string, number | string | boolean>;
  // 模型支持的功能
  features?: Partial<ModelFeatures>;
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

/**
 * AI Agent类型定义
 */
export type Agent = {
  id: string;
  name: string;
  description: string;
  systemPrompt: string;
  providerId: string;
  modelId: string;
  createdAt: Date;
  updatedAt: Date;
  // 是否保存上下文历史
  keepHistory: boolean;
  // 最大上下文历史消息数
  maxHistoryMessages?: number;
  // Agent图标
  icon?: string;
  // Agent设置
  settings?: {
    temperature?: number;
    topP?: number;
    maxTokens?: number;
    [key: string]: number | string | boolean | undefined;
  };
};

/**
 * Agent会话类型定义
 */
export type AgentSession = {
  id: string;
  agentId: string;
  name: string;
  messages: Message[];
  createdAt: Date;
  updatedAt: Date;
}; 