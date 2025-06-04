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
  id: string; // 模型标识符，既是API中使用的ID，也是显示名称
  // 模型特有的参数设置，如temperature, top_p等
  parameters?: Record<string, number | string | boolean>;
  // 模型支持的功能
  features?: Partial<ModelFeatures>;
};

/**
 * API请求头配置
 */
export type APIHeaderConfig = {
  key: string;
  value: string;
  valueTemplate?: string; // 支持模板，如 "Bearer {apiKey}"
};

/**
 * API请求体字段配置
 */
export type APIBodyFieldConfig = {
  path: string; // JSON路径，如 "model", "messages", "messages[].role"
  valueType: 'static' | 'dynamic' | 'template';
  value?: string | number | boolean; // 静态值
  valueTemplate?: string; // 模板，如 "{model}", "{message}", "{history}"
  description?: string; // 字段说明
};

/**
 * API响应解析配置
 */
export type APIResponseConfig = {
  // 响应内容提取路径
  contentPath: string; // 如 "choices[0].message.content", "completion"
  // 推理内容提取路径（可选，支持非流式和流式）
  reasoningPath?: string; // 如 "choices[0].message.reasoning_content"
  // 流式响应配置
  streamConfig?: {
    enabled: boolean;
    dataPrefix?: string; // SSE数据前缀，如 "data: "
    contentPath: string; // 流式响应中内容的路径
    reasoningPath?: string; // 推理内容路径
    finishCondition?: string; // 结束条件，如 "[DONE]"
  };
  // 错误响应处理
  errorConfig?: {
    messagePath?: string; // 错误信息路径，如 "error.message"
  };
};

/**
 * 自定义API配置
 */
export type CustomAPIConfig = {
  // 基础配置
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  contentType: string;
  
  // 请求头配置
  headers: APIHeaderConfig[];
  
  // 请求体配置
  bodyFields: APIBodyFieldConfig[];
  
  // 响应解析配置
  response: APIResponseConfig;
  
  // 模板变量说明
  templateVariables?: {
    [key: string]: string; // 变量名 -> 说明
  };
};

/**
 * AI提供商类型定义（扩展版）
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
  
  // 新增：自定义API配置
  customConfig?: CustomAPIConfig;
  // 是否使用自定义配置（如果为false，使用内置的硬编码逻辑）
  useCustomConfig?: boolean;
  
  // 预设配置类型（用于快速设置）
  presetType?: 'openai' | 'claude' | 'deepseek' | 'custom';
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
  // 是否使用流式模式
  isStreamMode?: boolean;
  // 温度设置
  temperature?: number;
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

/**
 * 场景类型定义
 */
export type Scene = {
  id: string;
  name: string;
  description: string;
  scenarioPrompt: string; // 场景背景提示词
  participants: SceneParticipant[];
  createdAt: Date;
  updatedAt: Date;
};

/**
 * 场景参与者类型定义
 */
export type SceneParticipant = {
  id: string; // 唯一标识，不同于agentId
  agentId: string;
  role: string; // 在场景中的角色名称
  contextPrompt: string; // 场景特定提示词（会与Agent的基础systemPrompt合并）
  interactionRules?: string; // 与其他Agent交互规则
  order?: number; // 交互顺序，可选
};

/**
 * 场景会话类型定义
 */
export type SceneSession = {
  id: string;
  sceneId: string;
  name: string;
  messages: SceneMessage[];
  createdAt: Date;
  updatedAt: Date;
  isActive: boolean;
};

/**
 * 场景消息类型定义
 */
export type SceneMessage = {
  id: string;
  participantId: string; // 场景参与者ID，包括用户
  agentId?: string; // 原始Agent ID
  role: 'user' | 'agent'; // 用户或Agent
  content: string;
  timestamp: Date;
  metadata?: Record<string, string | boolean | number | null>;
}; 