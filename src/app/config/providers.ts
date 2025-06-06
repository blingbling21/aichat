export const providerExamples: { [key: string]: AIProvider } = {
  "gemini-pro-streaming": {
    id: "gemini-pro-streaming",
    name: "Google Gemini (流式版本)",
    type: "custom",
    apiKey: "",
    apiEndpoint: "https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent",
    model: "gemini-pro",
    customConfig: {
      method: "POST",
      contentType: "application/json",
      headers: [],
      queryParams: [
        {
          key: "key",
          value: "{apiKey}",
          valueType: "template"
        }
      ],
      bodyFields: [
        {
          path: "contents",
          valueType: "messages",
          messagesConfig: {
            format: "gemini"
          }
        }
      ],
      streamConfig: {
        enabled: true,
        requestType: "url_endpoint",
        request: {
          urlReplacement: {
            from: "generateContent",
            to: "streamGenerateContent"
          }
        },
        response: {
          dataPrefix: "data: ",
          contentPath: "candidates[0].content.parts[0].text",
          finishCondition: "[DONE]"
        }
      },
      response: {
        contentPath: "candidates[0].content.parts[0].text"
      }
    }
  },

  "openai-gpt4-streaming": {
    id: "openai-gpt4-streaming",
    name: "OpenAI GPT-4 (流式版本)",
    type: "custom", 
    apiKey: "",
    apiEndpoint: "https://api.openai.com/v1/chat/completions",
    model: "gpt-4",
    customConfig: {
      method: "POST",
      contentType: "application/json",
      headers: [
        {
          key: "Authorization",
          value: "Bearer {apiKey}",
          valueTemplate: "Bearer {apiKey}"
        }
      ],
      bodyFields: [
        {
          path: "model",
          valueType: "template",
          valueTemplate: "{model}"
        },
        {
          path: "messages",
          valueType: "messages",
          messagesConfig: {
            format: "openai"
          }
        }
      ],
      streamConfig: {
        enabled: true,
        requestType: "body_field",
        request: {
          bodyFieldPath: "stream",
          bodyFieldValue: true
        },
        response: {
          dataPrefix: "data: ",
          contentPath: "choices[0].delta.content",
          reasoningPath: "choices[0].delta.reasoning_content",
          finishCondition: "[DONE]"
        }
      },
      response: {
        contentPath: "choices[0].message.content",
        reasoningPath: "choices[0].message.reasoning_content"
      }
    }
  },

  "custom-api-with-query-streaming": {
    id: "custom-api-streaming",
    name: "自定义API (查询参数流式)",
    type: "custom",
    apiKey: "",
    apiEndpoint: "https://api.example.com/v1/chat",
    model: "custom-model",
    customConfig: {
      method: "POST",
      contentType: "application/json",
      headers: [
        {
          key: "Authorization",
          value: "Bearer {apiKey}",
          valueTemplate: "Bearer {apiKey}"
        }
      ],
      bodyFields: [
        {
          path: "prompt",
          valueType: "template",
          valueTemplate: "{message}"
        },
        {
          path: "model",
          valueType: "template", 
          valueTemplate: "{model}"
        }
      ],
      streamConfig: {
        enabled: true,
        requestType: "query_param",
        request: {
          queryParamKey: "stream",
          queryParamValue: "true"
        },
        response: {
          dataPrefix: "data: ",
          contentPath: "text",
          finishCondition: "[DONE]"
        }
      },
      response: {
        contentPath: "completion"
      }
    }
  }
}; 