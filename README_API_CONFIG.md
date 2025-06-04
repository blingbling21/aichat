# AI提供商完全自主配置系统

## 🚀 重要更新

**彻底移除所有硬编码！** 现在系统：
1. **强制自主配置** - 用户必须完全配置API参数才能使用任何AI服务
2. **无预设选项** - 不提供任何预设配置，确保用户完全自主控制
3. **完全透明** - 用户对API调用的每个参数都有完全控制权

## 概述

我们实现了一个完全自主的AI提供商配置系统，彻底消除了硬编码。用户必须根据AI服务的API文档完全配置所有参数，确保：

- ✅ **完全消除硬编码** - 没有任何内置的默认API调用逻辑
- ✅ **强制用户配置** - 必须配置API才能使用服务
- ✅ **无预设选项** - 不提供OpenAI、Claude等预设，完全自主
- ✅ **完全自主控制** - 用户对每个API参数都有完全控制权

## 🎯 使用要求

### 1. 强制配置
- 添加AI提供商后，**必须**点击"高级"按钮配置API
- 没有配置API参数无法使用任何功能
- 不提供任何预设配置选项

### 2. 配置验证
系统会验证以下必填项：
- 至少一个请求头（通常是API密钥认证）
- 至少一个请求体字段
- 响应内容提取路径

### 3. 完全自主
用户需要根据AI服务的API文档：
- 配置请求方法（GET/POST/PUT/DELETE）
- 配置请求头（认证、版本等）
- 配置请求体字段（模型、消息、参数等）
- 配置响应解析路径
- 配置流式响应（如支持）

## 核心功能

### 1. 完全可配置的API请求

```typescript
export type CustomAPIConfig = {
  // 基础配置
  method: 'GET' | 'POST' | 'PUT' | 'DELETE';
  contentType: string;
  
  // 请求头配置 - 支持模板变量
  headers: APIHeaderConfig[];
  
  // 请求体配置 - 支持静态、模板、动态值
  bodyFields: APIBodyFieldConfig[];
  
  // 响应解析配置 - 支持嵌套路径提取
  response: APIResponseConfig;
};
```

### 2. 灵活的字段配置

#### 请求头配置
```typescript
{
  key: 'Authorization',
  value: '',
  valueTemplate: 'Bearer {apiKey}' // 支持模板变量
}
```

#### 请求体字段配置
```typescript
{
  path: 'model',                    // JSON路径
  valueType: 'template',            // 值类型：static/template/dynamic
  valueTemplate: '{model}',         // 模板值
  description: '模型名称'           // 说明
}
```

#### 响应解析配置
```typescript
{
  contentPath: 'choices[0].message.content',    // 内容提取路径
  streamConfig: {                               // 流式配置
    enabled: true,
    dataPrefix: 'data: ',
    contentPath: 'choices[0].delta.content',
    reasoningPath: 'choices[0].delta.reasoning_content',
    finishCondition: '[DONE]'
  },
  errorConfig: {                                // 错误处理
    messagePath: 'error.message'
  }
}
```

### 3. 模板变量系统

支持以下模板变量：
- `{apiKey}`: 用户设置的API密钥
- `{model}`: 选中的模型ID  
- `{stream}`: 是否启用流式返回
- `{message}`: 当前用户消息
- `{history}`: 历史对话记录

### 4. 完整的流式支持

- 自定义SSE数据格式解析
- 支持推理内容提取（如DeepSeek R1）
- 可配置数据前缀和结束条件
- 错误处理和重连机制

## 实现原理

### 1. 强制配置检查

```typescript
private async callAI(...) {
  // 检查是否有自定义配置
  if (!provider.customConfig) {
    throw new Error(`提供商 ${provider.name} 未配置API参数。请在设置中配置API后再使用。`);
  }
  
  // 只调用自定义配置API
  return this.callCustomAPI(...);
}
```

### 2. 通用API调用引擎

- `buildCustomAPIRequest()`: 根据配置构建请求
- `processTemplate()`: 处理模板变量替换  
- `buildFieldValue()`: 构建字段值（静态/模板/动态）
- `extractResponseContent()`: 提取响应内容
- `streamCustomAPI()`: 流式调用处理

### 3. 配置验证

界面会验证：
- 响应内容提取路径不能为空
- 至少需要一个请求头
- 至少需要一个请求体字段

## 🛠️ 配置示例

### OpenAI兼容API配置

```json
{
  "method": "POST",
  "contentType": "application/json",
  "headers": [
    {"key": "Authorization", "valueTemplate": "Bearer {apiKey}"}
  ],
  "bodyFields": [
    {"path": "model", "valueType": "template", "valueTemplate": "{model}"},
    {"path": "messages", "valueType": "dynamic"},
    {"path": "temperature", "valueType": "static", "value": 0.7},
    {"path": "stream", "valueType": "template", "valueTemplate": "{stream}"}
  ],
  "response": {
    "contentPath": "choices[0].message.content",
    "streamConfig": {
      "enabled": true,
      "dataPrefix": "data: ",
      "contentPath": "choices[0].delta.content",
      "finishCondition": "[DONE]"
    }
  }
}
```

### Claude API配置

```json
{
  "method": "POST", 
  "contentType": "application/json",
  "headers": [
    {"key": "x-api-key", "valueTemplate": "{apiKey}"},
    {"key": "anthropic-version", "value": "2023-06-01"}
  ],
  "bodyFields": [
    {"path": "model", "valueType": "template", "valueTemplate": "{model}"},
    {"path": "max_tokens", "valueType": "static", "value": 1000},
    {"path": "messages", "valueType": "dynamic"}
  ],
  "response": {
    "contentPath": "content[0].text"
  }
}
```

### 自定义API配置

用户可以配置任何符合HTTP API规范的AI服务：
- 国内外各种大语言模型API
- 自建的AI服务
- 第三方AI聚合服务  
- 企业内部AI服务

## 优势

1. **完全自主** - 用户对API调用拥有完全控制权
2. **无限扩展** - 支持任何HTTP API规范的AI服务
3. **完全透明** - 没有隐藏的硬编码逻辑
4. **强制规范** - 用户必须理解和配置API，提高认知
5. **功能完整** - 支持流式响应、错误处理、模板变量等

这个实现确保了用户必须根据AI服务的API文档完全自主配置，彻底消除了硬编码，实现了真正的"用户完全自主控制"！ 