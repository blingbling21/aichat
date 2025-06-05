# AI API配置示例

本文档提供了各种主流AI服务的完整配置示例，展示如何使用项目的通用API配置系统支持不同格式的AI API。

## 🔧 DeepSeek API配置

DeepSeek使用OpenAI兼容格式，支持推理模型。

```json
{
  "method": "POST",
  "contentType": "application/json",
  "headers": [
    {
      "key": "Authorization",
      "valueTemplate": "Bearer {apiKey}"
    }
  ],
  "bodyFields": [
    {
      "path": "model",
      "valueType": "template",
      "valueTemplate": "{model}",
      "description": "模型名称：deepseek-chat 或 deepseek-reasoner"
    },
    {
      "path": "messages",
      "valueType": "dynamic",
      "description": "消息历史数组",
      "messageTransform": {
        "format": "openai"
      }
    },
    {
      "path": "temperature",
      "valueType": "template",
      "valueTemplate": "{temperature}",
      "description": "温度参数 (0-2)"
    },
    {
      "path": "stream",
      "valueType": "template",
      "valueTemplate": "{stream}",
      "description": "是否使用流式返回"
    }
  ],
  "response": {
    "contentPath": "choices[0].message.content",
    "reasoningPath": "choices[0].message.reasoning_content",
    "streamConfig": {
      "enabled": true,
      "dataPrefix": "data: ",
      "contentPath": "choices[0].delta.content",
      "reasoningPath": "choices[0].delta.reasoning_content",
      "finishCondition": "[DONE]"
    },
    "errorConfig": {
      "messagePath": "error.message"
    }
  }
}
```

## 🤖 Google Gemini API配置

Gemini使用Google特有的API格式，模型名在URL中，API密钥在查询参数中。

```json
{
  "method": "POST",
  "contentType": "application/json",
  "urlTemplate": "https://generativelanguage.googleapis.com/v1beta/models/{model}:generateContent",
  "queryParams": [
    {
      "key": "key",
      "valueType": "template",
      "valueTemplate": "{apiKey}",
      "description": "API密钥"
    }
  ],
  "headers": [],
  "bodyFields": [
    {
      "path": "contents",
      "valueType": "dynamic",
      "description": "Gemini格式的消息数组",
      "messageTransform": {
        "format": "gemini",
        "customMapping": {
          "roleField": "role",
          "userRoleValue": "user",
          "assistantRoleValue": "model"
        }
      }
    },
    {
      "path": "generationConfig.temperature",
      "valueType": "template",
      "valueTemplate": "{temperature}",
      "description": "温度参数"
    }
  ],
  "response": {
    "contentPath": "candidates[0].content.parts[0].text",
    "errorConfig": {
      "messagePath": "error.message"
    }
  }
}
```

## 🧠 Anthropic Claude API配置

Claude使用自己的API格式，需要特定的版本头。

```json
{
  "method": "POST",
  "contentType": "application/json",
  "headers": [
    {
      "key": "x-api-key",
      "valueTemplate": "{apiKey}"
    },
    {
      "key": "anthropic-version",
      "value": "2023-06-01"
    },
    {
      "key": "anthropic-beta",
      "value": "messages-2023-12-15"
    }
  ],
  "bodyFields": [
    {
      "path": "model",
      "valueType": "template",
      "valueTemplate": "{model}",
      "description": "Claude模型名称"
    },
    {
      "path": "max_tokens",
      "valueType": "static",
      "value": 4000,
      "description": "最大token数"
    },
    {
      "path": "messages",
      "valueType": "dynamic",
      "description": "消息历史（不包含system）",
      "messageTransform": {
        "format": "claude"
      }
    },
    {
      "path": "system",
      "valueType": "template",
      "valueTemplate": "{systemPrompt}",
      "description": "系统提示词（单独字段）"
    },
    {
      "path": "temperature",
      "valueType": "template",
      "valueTemplate": "{temperature}",
      "description": "温度参数"
    }
  ],
  "response": {
    "contentPath": "content[0].text",
    "streamConfig": {
      "enabled": true,
      "dataPrefix": "data: ",
      "contentPath": "delta.text",
      "finishCondition": "event: message_stop"
    },
    "errorConfig": {
      "messagePath": "error.message"
    }
  }
}
```

## 🔥 通义千问API配置

阿里云通义千问的配置示例。

```json
{
  "method": "POST",
  "contentType": "application/json",
  "headers": [
    {
      "key": "Authorization",
      "valueTemplate": "Bearer {apiKey}"
    },
    {
      "key": "Content-Type",
      "value": "application/json"
    }
  ],
  "bodyFields": [
    {
      "path": "model",
      "valueType": "template",
      "valueTemplate": "{model}",
      "description": "通义千问模型名称"
    },
    {
      "path": "input.messages",
      "valueType": "dynamic",
      "description": "嵌套的消息数组",
      "messageTransform": {
        "format": "openai"
      }
    },
    {
      "path": "parameters.temperature",
      "valueType": "template",
      "valueTemplate": "{temperature}",
      "description": "温度参数"
    },
    {
      "path": "parameters.incremental_output",
      "valueType": "template",
      "valueTemplate": "{stream}",
      "description": "流式输出"
    }
  ],
  "response": {
    "contentPath": "output.text",
    "streamConfig": {
      "enabled": true,
      "dataPrefix": "data:",
      "contentPath": "output.text",
      "finishCondition": "data:[DONE]"
    },
    "errorConfig": {
      "messagePath": "message"
    }
  }
}
```

## 🎯 自定义API配置

针对完全自定义的API格式示例。

```json
{
  "method": "POST",
  "contentType": "application/json",
  "urlTemplate": "https://your-api.com/v1/chat/{model}",
  "queryParams": [
    {
      "key": "version",
      "valueType": "static",
      "value": "1.0"
    }
  ],
  "headers": [
    {
      "key": "X-API-Token",
      "valueTemplate": "{apiKey}"
    },
    {
      "key": "X-Client-Version",
      "value": "aichat-1.0"
    }
  ],
  "bodyFields": [
    {
      "path": "conversation",
      "valueType": "dynamic",
      "description": "自定义消息格式",
      "messageTransform": {
        "format": "custom",
        "customMapping": {
          "roleField": "speaker",
          "contentField": "text",
          "systemRoleValue": "system",
          "userRoleValue": "human",
          "assistantRoleValue": "ai",
          "wrapperField": "segments"
        }
      }
    },
    {
      "path": "config.creativity",
      "valueType": "template",
      "valueTemplate": "{temperature}",
      "description": "创造性参数"
    },
    {
      "path": "config.streaming",
      "valueType": "template",
      "valueTemplate": "{stream}",
      "description": "流式模式"
    }
  ],
  "response": {
    "contentPath": "result.response.text",
    "streamConfig": {
      "enabled": true,
      "dataPrefix": "event: chunk\ndata: ",
      "contentPath": "chunk.text",
      "finishCondition": "event: done"
    },
    "errorConfig": {
      "messagePath": "error.details"
    }
  }
}
```

## 📝 配置说明

### URL模板化
- 使用 `urlTemplate` 字段可以在URL中嵌入变量
- 支持 `{model}`, `{apiKey}`, `{endpoint}` 等模板变量

### 查询参数
- `queryParams` 数组支持在URL中添加查询参数
- 每个参数可以是静态值或模板值

### 消息格式转换
- `messageTransform.format` 支持：
  - `openai`: 标准的messages格式
  - `gemini`: Google Gemini的contents格式  
  - `claude`: Anthropic Claude格式
  - `custom`: 完全自定义格式

### 嵌套字段
- 使用点号分隔路径：`input.messages`, `parameters.temperature`
- 支持数组索引：`choices[0].message.content`

### 模板变量
系统支持以下内置模板变量：
- `{apiKey}`: API密钥
- `{model}`: 模型名称
- `{message}`: 当前用户消息
- `{history}`: 消息历史
- `{systemPrompt}`: 系统提示词
- `{temperature}`: 温度参数
- `{stream}`: 是否流式返回
- `{endpoint}`: API端点URL

## 🚀 使用建议

1. **测试配置**: 每次修改配置后，使用"测试连接"功能验证
2. **日志调试**: 开启详细日志，观察请求和响应格式
3. **渐进配置**: 先配置基本功能，再添加高级特性
4. **参考文档**: 仔细阅读各AI服务的官方API文档
5. **社区分享**: 将成功的配置分享给其他用户

通过这套灵活的配置系统，您可以接入几乎任何符合HTTP标准的AI API服务！ 