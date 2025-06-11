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
  generationStartTime?: Date; // 生成开始时间
  generationEndTime?: Date; // 生成结束时间
  generationDuration?: number; // 生成耗时（毫秒）
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
  value?: string;
  valueTemplate?: string; // 支持模板，如 "Bearer {apiKey}"
  valueType: 'static' | 'template';
  description?: string;
};

/**
 * API请求体字段配置
 */
export type APIBodyFieldConfig = {
  path: string; // JSON路径，如 "model", "messages", "messages[].role"
  valueType: 'static' | 'dynamic' | 'template' | 'visual_structure'; // 新增visual_structure类型
  value?: string | number | boolean; // 静态值
  valueTemplate?: string; // 模板，如 "{model}", "{message}", "{history}"
  description?: string; // 字段说明
  
  // 传统消息格式转换配置（向后兼容）
  messageTransform?: {
    format: 'openai' | 'gemini' | 'claude' | 'custom';
    customMapping?: {
      roleField?: string;
      contentField?: string;
      systemRoleValue?: string;
      userRoleValue?: string;
      assistantRoleValue?: string;
      wrapperField?: string;
    };
  };
  
  // 新增：可视化消息结构配置
  messageStructure?: MessageStructureConfig;
};

/**
 * 流式请求配置
 */
export type StreamConfig = {
  enabled: boolean;
  // 流式请求方式
  requestType: 'body_field' | 'url_endpoint' | 'query_param';
  
  // 请求配置：如何发送流式请求
  request: {
    // body_field类型：通过请求体字段控制（如OpenAI的stream: true）
    bodyFieldPath?: string; // 如 "stream"
    bodyFieldValue?: boolean | string; // 如 true
    
    // url_endpoint类型：通过改变URL端点（如Gemini的generateContent -> streamGenerateContent）
    urlReplacement?: {
      from: string; // 替换源，如 "generateContent"
      to: string;   // 替换目标，如 "streamGenerateContent"
    };
    
    // query_param类型：通过查询参数控制
    queryParamKey?: string; // 如 "stream"
    queryParamValue?: string; // 如 "true"
  };
  
  // 响应配置：如何解析流式响应
  response: {
    format: 'sse' | 'json'; // 响应格式：SSE格式（如OpenAI）或JSON数组格式（如Gemini）
    dataPrefix?: string; // SSE数据前缀，如 "data: "（仅SSE格式使用）
    contentPath: string; // 流式响应中内容的路径，如 "choices[0].delta.content"
    reasoningPath?: string; // 推理内容路径，如 "choices[0].delta.reasoning_content"
    finishCondition?: string; // 结束条件，如 "[DONE]"
  };
};

/**
 * API响应解析配置
 */
export type APIResponseConfig = {
  // 响应内容提取路径
  contentPath: string; // 如 "choices[0].message.content", "completion"
  // 推理内容提取路径（可选，支持非流式和流式）
  reasoningPath?: string; // 如 "choices[0].message.reasoning_content"
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
  
  // URL模板配置 - 新增
  urlTemplate?: string; // 支持模板变量，如 "https://api.example.com/models/{model}/generate"
  
  // 查询参数配置 - 新增
  queryParams?: APIQueryParamConfig[];
  
  // 请求头配置
  headers: APIHeaderConfig[];
  
  // 请求体配置
  bodyFields: APIBodyFieldConfig[];
  
  // 流式请求配置 - 新增独立配置
  streamConfig?: StreamConfig;
  
  // 响应解析配置
  response: APIResponseConfig;
  
  // 模板变量说明
  templateVariables?: {
    [key: string]: string; // 变量名 -> 说明
  };
};

/**
 * API查询参数配置 - 新增
 */
export type APIQueryParamConfig = {
  key: string;
  value?: string;
  valueTemplate?: string; // 支持模板，如 "{apiKey}"
  valueType: 'static' | 'template';
  description?: string;
};

/**
 * 余额API响应字段配置
 */
export type BalanceResponseField = {
  fieldPath: string; // 字段路径，如 "is_available"
  displayName: string; // 显示名称，如 "账户可用状态"
};

/**
 * API自动获取配置
 */
export type APIAutoFetchConfig = {
  // 模型列表API配置
  modelsApi?: {
    enabled?: boolean;
    endpoint?: string; // API端点，如 "https://api.openai.com/v1/models"
    method?: 'GET' | 'POST';
    headers?: APIHeaderConfig[]; // 请求头，如认证信息
    responsePath?: string; // 模型列表在响应中的路径，如 "data" 或 ""（根级别）
    modelIdPath?: string; // 模型ID在每个模型对象中的路径，如 "id"
    modelNamePath?: string; // 模型名称路径，如 "name" 或 "id"（如果与ID相同）
    modelDescriptionPath?: string; // 模型描述路径，如 "description"
    filterPattern?: string; // 模型过滤正则表达式，如 "^gpt-" 只获取GPT模型
  };
  
  // 费用/定价API配置
  pricingApi?: {
    enabled?: boolean;
    endpoint?: string; // API端点
    method?: 'GET' | 'POST';
    headers?: APIHeaderConfig[];
    responsePath?: string; // 定价信息在响应中的路径
    modelPricePath?: string; // 每个模型价格的路径
  };

  // 账户余额API配置
  balanceApi?: {
    enabled?: boolean;
    endpoint?: string; // API端点，如 "https://api.deepseek.com/user/balance"
    method?: 'GET' | 'POST';
    headers?: APIHeaderConfig[]; // 请求头，如认证信息
    responsePath?: string; // 余额信息在响应中的路径，如 ""（根级别）
    balanceInfoPath?: string; // 余额字段路径，如 "balance_infos[0].total_balance"
    currencyPath?: string; // 货币字段路径，如 "balance_infos[0].currency"
    availablePath?: string; // 可用状态路径，如 "is_available"
    // 新增：响应字段配置
    responseFields?: BalanceResponseField[];
  };
  
  // 自动更新设置
  autoUpdate?: {
    enabled?: boolean;
    intervalHours?: number; // 自动更新间隔（小时），默认24小时
    lastUpdateTime?: Date; // 上次更新时间
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
  
  // 新增：API自动获取配置
  autoFetchConfig?: APIAutoFetchConfig;
  
  // 预设配置类型（用于快速设置）
  presetType?: 'openai' | 'claude' | 'deepseek' | 'custom';
};

/**
 * 代理设置类型定义
 */
export type ProxySettings = {
  enabled: boolean;
  type: 'http' | 'https' | 'socks5'; // 新增：代理类型
  host: string;
  port: number;
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

/**
 * JSON节点类型定义 - 用于可视化JSON结构生成器
 */
export type JsonNode = {
  id: string;
  type: 'object' | 'array' | 'string' | 'number' | 'boolean' | 'template';
  key?: string; // 对象的键名
  value?: string | number | boolean; // 静态值
  templateVariable?: string; // 模板变量，如 'role', 'content', 'message'
  description?: string; // 节点说明
  children?: JsonNode[]; // 子节点
  isRequired?: boolean; // 是否必需
  arrayItemTemplate?: JsonNode; // 数组项的模板结构
};

/**
 * 消息结构配置 - 新的消息配置方式
 */
export type MessageStructureConfig = {
  enabled: boolean; // 是否启用可视化结构配置
  rootNode: JsonNode; // 根节点
  roleMapping: { // 角色映射
    user: string;
    assistant: string;
    system: string;
  };
  previewData?: { // 预览数据
    generatedTemplate: string;
    sampleOutput: string;
  };
}; 