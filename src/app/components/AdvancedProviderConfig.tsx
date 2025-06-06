import React, { useState, useEffect } from 'react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Plus, Trash2, ChevronDown, HelpCircle, Info } from 'lucide-react';
import { toast } from 'sonner';
import { AIProvider, CustomAPIConfig, APIHeaderConfig, APIBodyFieldConfig, MessageStructureConfig, APIQueryParamConfig } from '../types';
import { JsonStructureBuilder } from './JsonStructureBuilder';


interface AdvancedProviderConfigProps {
  open: boolean;
  onClose: () => void;
  provider: AIProvider | null;
  onSave: (provider: AIProvider) => void;
}

// 简单的可折叠组件
const Collapsible: React.FC<{
  title: string;
  children: React.ReactNode;
  defaultOpen?: boolean;
}> = ({ title, children, defaultOpen = false }) => {
  const [isOpen, setIsOpen] = useState(defaultOpen);

  return (
    <div className="border rounded-md">
      <button
        onClick={() => setIsOpen(!isOpen)}
        className="w-full flex items-center justify-between p-4 text-left hover:bg-gray-50"
      >
        <h3 className="font-medium">{title}</h3>
        <ChevronDown 
          className={`h-4 w-4 transition-transform ${isOpen ? 'rotate-180' : ''}`}
        />
      </button>
      {isOpen && (
        <div className="border-t p-4">
          {children}
        </div>
      )}
    </div>
  );
};

// 简单的标签组件
const Chip: React.FC<{
  label: string;
  onClick?: () => void;
  variant?: 'default' | 'selected';
}> = ({ label, onClick, variant = 'default' }) => {
  return (
    <button
      onClick={onClick}
      className={`inline-flex items-center px-3 py-1 rounded-full text-sm font-medium transition-colors ${
        variant === 'selected'
          ? 'bg-blue-100 text-blue-800 border-blue-200'
          : 'bg-gray-100 text-gray-800 border-gray-200 hover:bg-gray-200'
      } border`}
    >
      {label}
    </button>
  );
};

const AdvancedProviderConfig: React.FC<AdvancedProviderConfigProps> = ({
  open,
  onClose,
  provider,
  onSave
}) => {
  const [config, setConfig] = useState<CustomAPIConfig>({
    method: 'POST',
    contentType: 'application/json',
    headers: [],
    bodyFields: [],
    streamConfig: {
      enabled: false,
      requestType: 'body_field',
      request: {
        urlReplacement: {
          from: 'generateContent',
          to: 'streamGenerateContent'
        }
      },
      response: {
        format: 'sse',
        dataPrefix: 'data: ',
        contentPath: '',
        finishCondition: '[DONE]'
      }
    },
    response: {
      contentPath: ''
    }
  }); // 默认配置，不为null

  useEffect(() => {
    if (provider) {
      if (provider.customConfig) {
        setConfig(provider.customConfig);
      } else {
        // 使用默认的空配置
        setConfig({
          method: 'POST',
          contentType: 'application/json',
          headers: [],
          bodyFields: [],
          streamConfig: {
            enabled: false,
            requestType: 'body_field',
            request: {},
            response: {
              format: 'sse',
              dataPrefix: 'data: ',
              contentPath: '',
              finishCondition: '[DONE]'
            }
          },
          response: {
            contentPath: ''
          }
        });
      }
    }
  }, [provider]);

  const handleSave = () => {
    if (!provider) return;

    // 验证必填字段
    if (!config.response.contentPath) {
      toast.error('请配置响应内容提取路径');
      return;
    }

    if (config.headers.length === 0) {
      toast.error('请至少配置一个请求头（如API密钥认证）');
      return;
    }

    if (config.bodyFields.length === 0) {
      toast.error('请至少配置一个请求体字段');
      return;
    }

    const updatedProvider: AIProvider = {
      ...provider,
      customConfig: config,
      presetType: 'custom' // 所有都是自定义
    };

    onSave(updatedProvider);
    onClose();
    toast.success('API配置已保存');
  };

  const addHeader = () => {
    if (!config) return;
    setConfig({
      ...config,
      headers: [...config.headers, { key: '', value: '' }]
    });
  };

  const updateHeader = (index: number, field: keyof APIHeaderConfig, value: string) => {
    if (!config) return;
    const newHeaders = [...config.headers];
    newHeaders[index] = { ...newHeaders[index], [field]: value };
    setConfig({ ...config, headers: newHeaders });
  };

  const removeHeader = (index: number) => {
    if (!config) return;
    setConfig({
      ...config,
      headers: config.headers.filter((_, i) => i !== index)
    });
  };

  const addBodyField = () => {
    if (!config) return;
    setConfig({
      ...config,
      bodyFields: [...config.bodyFields, { 
        path: '', 
        valueType: 'static', 
        value: '', 
        description: '' 
      }]
    });
  };

  const updateBodyField = (index: number, field: keyof APIBodyFieldConfig, value: string | number | boolean) => {
    if (!config) return;
    const newFields = [...config.bodyFields];
    newFields[index] = { ...newFields[index], [field]: value };
    setConfig({ ...config, bodyFields: newFields });
  };

  const removeBodyField = (index: number) => {
    if (!config) return;
    setConfig({
      ...config,
      bodyFields: config.bodyFields.filter((_, i) => i !== index)
    });
  };

  if (!provider) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="!max-w-[95vw] !w-full max-h-[90vh] overflow-y-auto sm:!max-w-[95vw]">
        <DialogHeader>
          <DialogTitle>高级API配置 - {provider?.name}</DialogTitle>
          <DialogDescription>
            完全自定义API请求参数，支持任何符合HTTP API规范的AI服务
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-6">
          {/* 移除启用/禁用选项，强制使用自定义配置 */}
          <div className="p-4 bg-blue-50 rounded-lg">
            <div className="flex items-start space-x-3">
              <Info className="h-5 w-5 text-blue-500 mt-0.5" />
              <div>
                <h4 className="font-medium text-blue-900">必须配置API</h4>
                <p className="text-sm text-blue-700 mt-1">
                  必须根据AI服务的API文档完全配置后才能使用。不提供预设配置，确保完全自主控制。
                </p>
                {provider?.name.toLowerCase().includes('deepseek') && (
                  <div className="mt-2 text-xs text-blue-600">
                    <strong>DeepSeek API 配置参考：</strong><br/>
                    • 请求头：Authorization = Bearer {'{'}apiKey{'}'}<br/>
                    • 请求体：model={'{'}model{'}'}, messages(动态), stream={'{'}stream{'}'}<br/>
                    • 响应路径：choices[0].message.content<br/>
                    • 流式路径：choices[0].delta.content
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* 基本配置 */}
          <Collapsible title="基本配置" defaultOpen={true}>
            <div className="grid grid-cols-2 gap-4">
              <div>
                <Label htmlFor="method">请求方法</Label>
                <Select
                  value={config.method}
                  onValueChange={(value: 'GET' | 'POST' | 'PUT' | 'DELETE') => 
                    setConfig({ ...config, method: value })
                  }
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="GET">GET</SelectItem>
                    <SelectItem value="POST">POST</SelectItem>
                    <SelectItem value="PUT">PUT</SelectItem>
                    <SelectItem value="DELETE">DELETE</SelectItem>
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="content-type">Content-Type</Label>
                <Input
                  id="content-type"
                  value={config.contentType}
                  onChange={(e) => setConfig({ ...config, contentType: e.target.value })}
                />
              </div>
            </div>
          </Collapsible>

          {/* 请求头配置 */}
          <Collapsible title="请求头配置">
            <div className="space-y-4">
              <Button onClick={addHeader} variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-1" />
                添加请求头
              </Button>
              {config.headers.map((header, index) => (
                <Card key={index}>
                  <CardContent className="p-4">
                    <div className="space-y-3">
                      <div className="flex gap-2 items-end">
                        <div className="flex-1">
                          <Label>键名</Label>
                          <Input
                            value={header.key}
                            onChange={(e) => updateHeader(index, 'key', e.target.value)}
                            placeholder="如: Authorization"
                          />
                        </div>
                        <div className="flex-1">
                          <Label>值类型</Label>
                          <Select
                            value={header.valueTemplate ? 'template' : 'static'}
                            onValueChange={(value) => {
                              if (value === 'template') {
                                updateHeader(index, 'valueTemplate', header.value || '');
                                updateHeader(index, 'value', '');
                              } else {
                                updateHeader(index, 'value', header.valueTemplate || '');
                                updateHeader(index, 'valueTemplate', '');
                              }
                            }}
                          >
                            <SelectTrigger>
                              <SelectValue />
                            </SelectTrigger>
                            <SelectContent>
                              <SelectItem value="static">固定值</SelectItem>
                              <SelectItem value="template">模板值</SelectItem>
                            </SelectContent>
                          </Select>
                        </div>
                        <Button 
                          onClick={() => removeHeader(index)} 
                          variant="destructive" 
                          size="sm"
                          className="px-2"
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                      
                      <div>
                        {header.valueTemplate ? (
                          <div>
                            <Label>模板值</Label>
                            <Input
                              value={header.valueTemplate}
                              onChange={(e) => updateHeader(index, 'valueTemplate', e.target.value)}
                              placeholder="如: Bearer {apiKey}"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              支持变量: {'{apiKey}'}, {'{model}'}, {'{endpoint}'}
                            </p>
                          </div>
                        ) : (
                          <div>
                            <Label>固定值</Label>
                            <Input
                              value={header.value}
                              onChange={(e) => updateHeader(index, 'value', e.target.value)}
                              placeholder="如: application/json"
                            />
                            <p className="text-xs text-gray-500 mt-1">
                              固定不变的值
                            </p>
                          </div>
                        )}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>
          </Collapsible>

          {/* 请求体字段配置 */}
          <Collapsible title="请求体字段配置">
            <div className="space-y-4">
              <Button onClick={addBodyField} variant="outline" size="sm">
                <Plus className="h-4 w-4 mr-1" />
                添加字段
              </Button>
              {config.bodyFields.map((field, index) => (
                <Card key={index}>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex gap-2 items-center">
                      <div className="flex-1">
                        <Label>字段路径</Label>
                        <Input
                          value={field.path}
                          onChange={(e) => updateBodyField(index, 'path', e.target.value)}
                          placeholder="如: model, messages, temperature"
                        />
                      </div>
                      <div className="flex-1">
                        <Label>值类型</Label>
                        <Select
                          value={field.valueType}
                          onValueChange={(value) => updateBodyField(index, 'valueType', value)}
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="static">静态值</SelectItem>
                            <SelectItem value="template">模板</SelectItem>
                            <SelectItem value="dynamic">动态生成</SelectItem>
                            <SelectItem value="visual_structure">可视化结构</SelectItem>
                          </SelectContent>
                        </Select>
                      </div>
                      <Button 
                        onClick={() => removeBodyField(index)} 
                        variant="destructive" 
                        size="sm"
                        className="px-2 mt-6"
                      >
                        <Trash2 className="h-4 w-4" />
                      </Button>
                    </div>
                    <div className="grid grid-cols-2 gap-2">
                      {field.valueType === 'static' && (
                        <div>
                          <Label>静态值</Label>
                          <Input
                                                    value={field.value?.toString() ?? ''}
                        onChange={(e) => updateBodyField(index, 'value', e.target.value)}
                            placeholder="如: 0.7, true, gpt-4"
                          />
                        </div>
                      )}
                      {field.valueType === 'template' && (
                        <div>
                          <Label>模板值</Label>
                          <Input
                                                    value={field.valueTemplate ?? ''}
                        onChange={(e) => updateBodyField(index, 'valueTemplate', e.target.value)}
                            placeholder="如: {model}, {stream}, {message}"
                          />
                        </div>
                      )}
                      <div>
                        <Label>字段说明</Label>
                        <Input
                                                  value={field.description ?? ''}
                        onChange={(e) => updateBodyField(index, 'description', e.target.value)}
                          placeholder="说明这个字段的作用"
                        />
                      </div>
                    </div>
                    
                    {/* 可视化结构配置 */}
                    {field.valueType === 'visual_structure' && (
                      <div className="mt-4">
                        <JsonStructureBuilder
                          config={field.messageStructure || {
                            enabled: false,
                            rootNode: {
                              id: 'root',
                              type: 'array',
                              key: field.path,
                              description: '消息数组',
                              children: []
                            },
                            roleMapping: {
                              user: 'user',
                              assistant: 'assistant',
                              system: 'system'
                            }
                          }}
                          onChange={(messageStructure: MessageStructureConfig) => {
                            const updatedFields = [...config.bodyFields];
                            updatedFields[index] = { ...field, messageStructure };
                            setConfig({ ...config, bodyFields: updatedFields });
                          }}
                          fieldPath={field.path}
                        />
                      </div>
                    )}
                  </CardContent>
                </Card>
              ))}
            </div>
          </Collapsible>

          {/* 流式请求配置 - 独立配置区域 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">流式请求配置</CardTitle>
              <CardDescription>
                配置如何发送和解析流式API请求
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="stream-enabled"
                  checked={config.streamConfig?.enabled || false}
                  onCheckedChange={(checked) => setConfig({
                    ...config,
                    streamConfig: {
                      enabled: checked === true,
                      requestType: config.streamConfig?.requestType || 'body_field',
                      request: config.streamConfig?.request || {},
                      response: {
                        dataPrefix: config.streamConfig?.response?.dataPrefix || 'data: ',
                        contentPath: config.streamConfig?.response?.contentPath || '',
                        finishCondition: config.streamConfig?.response?.finishCondition || '[DONE]'
                      }
                    }
                  })}
                />
                <Label htmlFor="stream-enabled">启用流式响应</Label>
              </div>

              {config.streamConfig?.enabled && (
                <div className="space-y-4 p-4 border rounded-lg bg-gray-50">
                  {/* 请求方式选择 */}
                  <div>
                    <Label className="text-sm font-medium">流式请求方式</Label>
                    <Select
                      value={config.streamConfig?.requestType || 'body_field'}
                      onValueChange={(value: 'body_field' | 'url_endpoint' | 'query_param') => setConfig({
                        ...config,
                        streamConfig: config.streamConfig ? {
                          ...config.streamConfig,
                          requestType: value,
                          request: {
                            ...config.streamConfig.request,
                            // 根据requestType初始化对应字段
                            ...(value === 'url_endpoint' && !config.streamConfig.request?.urlReplacement ? {
                              urlReplacement: { from: 'generateContent', to: 'streamGenerateContent' }
                            } : {}),
                            ...(value === 'body_field' && !config.streamConfig.request?.bodyFieldPath ? {
                              bodyFieldPath: 'stream', bodyFieldValue: true
                            } : {}),
                            ...(value === 'query_param' && !config.streamConfig.request?.queryParamKey ? {
                              queryParamKey: 'stream', queryParamValue: 'true'
                            } : {})
                          }
                        } : {
                          enabled: true,
                          requestType: value,
                          request: value === 'url_endpoint' ? {
                            urlReplacement: { from: 'generateContent', to: 'streamGenerateContent' }
                          } : value === 'body_field' ? {
                            bodyFieldPath: 'stream', bodyFieldValue: true
                          } : {
                            queryParamKey: 'stream', queryParamValue: 'true'
                          },
                          response: { format: 'sse', dataPrefix: 'data: ', contentPath: '', finishCondition: '[DONE]' }
                        }
                      })}
                    >
                      <SelectTrigger>
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="body_field">请求体字段控制 (如OpenAI: stream: true)</SelectItem>
                        <SelectItem value="url_endpoint">URL端点替换 (如Gemini: generateContent→streamGenerateContent)</SelectItem>
                        <SelectItem value="query_param">查询参数控制 (如?stream=true)</SelectItem>
                      </SelectContent>
                    </Select>
                  </div>

                  {/* 请求配置 */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">请求配置</h4>
                    
                    {config.streamConfig?.requestType === 'body_field' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">字段路径</Label>
                          <Input
                            value={config.streamConfig?.request?.bodyFieldPath ?? ''}
                            onChange={(e) => setConfig({
                              ...config,
                              streamConfig: {
                                ...config.streamConfig!,
                                request: {
                                  ...config.streamConfig.request,
                                  bodyFieldPath: e.target.value
                                }
                              }
                            })}
                            placeholder="stream"
                            className="h-8 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">字段值</Label>
                          <Input
                            value={String(config.streamConfig?.request?.bodyFieldValue ?? '')}
                            onChange={(e) => setConfig({
                              ...config,
                              streamConfig: {
                                ...config.streamConfig!,
                                request: {
                                  ...config.streamConfig.request,
                                  bodyFieldValue: e.target.value === 'true' ? true : e.target.value === 'false' ? false : e.target.value
                                }
                              }
                            })}
                            placeholder="true"
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                    )}
                    
                    {config.streamConfig?.requestType === 'url_endpoint' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">替换源</Label>
                          <Input
                            value={config.streamConfig?.request?.urlReplacement?.from ?? ''}
                            onChange={(e) => setConfig({
                              ...config,
                              streamConfig: {
                                ...config.streamConfig!,
                                request: {
                                  ...config.streamConfig.request,
                                  urlReplacement: {
                                    from: e.target.value,
                                    to: config.streamConfig?.request?.urlReplacement?.to ?? ''
                                  }
                                }
                              }
                            })}
                            placeholder="generateContent"
                            className="h-8 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">替换为</Label>
                          <Input
                            value={config.streamConfig?.request?.urlReplacement?.to ?? ''}
                            onChange={(e) => setConfig({
                              ...config,
                              streamConfig: {
                                ...config.streamConfig!,
                                request: {
                                  ...config.streamConfig.request,
                                  urlReplacement: {
                                    from: config.streamConfig?.request?.urlReplacement?.from ?? '',
                                    to: e.target.value
                                  }
                                }
                              }
                            })}
                            placeholder="streamGenerateContent"
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                    )}
                    
                    {config.streamConfig?.requestType === 'query_param' && (
                      <div className="grid grid-cols-2 gap-2">
                        <div>
                          <Label className="text-xs">参数名</Label>
                          <Input
                            value={config.streamConfig?.request?.queryParamKey ?? ''}
                            onChange={(e) => setConfig({
                              ...config,
                              streamConfig: {
                                ...config.streamConfig!,
                                request: {
                                  ...config.streamConfig.request,
                                  queryParamKey: e.target.value
                                }
                              }
                            })}
                            placeholder="stream"
                            className="h-8 text-xs"
                          />
                        </div>
                        <div>
                          <Label className="text-xs">参数值</Label>
                          <Input
                            value={config.streamConfig?.request?.queryParamValue ?? ''}
                            onChange={(e) => setConfig({
                              ...config,
                              streamConfig: {
                                ...config.streamConfig!,
                                request: {
                                  ...config.streamConfig.request,
                                  queryParamValue: e.target.value
                                }
                              }
                            })}
                            placeholder="true"
                            className="h-8 text-xs"
                          />
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 响应配置 */}
                  <div className="space-y-3">
                    <h4 className="font-medium text-sm">响应解析配置</h4>
                    
                    <div>
                      <Label className="text-xs">响应格式</Label>
                      <Select
                        value={config.streamConfig?.response?.format ?? 'sse'}
                        onValueChange={(value: 'sse' | 'json') => setConfig({
                          ...config,
                          streamConfig: {
                            ...config.streamConfig!,
                            response: {
                              ...config.streamConfig.response!,
                              format: value
                            }
                          }
                        })}
                      >
                        <SelectTrigger className="h-8 text-xs">
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="sse">SSE格式 (如OpenAI: data: {`{...}`})</SelectItem>
                          <SelectItem value="json">JSON数组格式 (如Gemini: [{`{...}, {...}`}])</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                    
                    <div className="grid grid-cols-2 gap-2">
                      {(config.streamConfig?.response?.format === 'sse' || !config.streamConfig?.response?.format) && (
                        <div>
                          <Label className="text-xs">数据前缀</Label>
                          <Input
                            value={config.streamConfig?.response?.dataPrefix ?? ''}
                            onChange={(e) => setConfig({
                              ...config,
                              streamConfig: {
                                ...config.streamConfig!,
                                response: {
                                  ...config.streamConfig.response!,
                                  dataPrefix: e.target.value
                                }
                              }
                            })}
                            placeholder="data: "
                            className="h-8 text-xs"
                          />
                        </div>
                      )}
                      <div>
                        <Label className="text-xs">结束条件</Label>
                        <Input
                          value={config.streamConfig?.response?.finishCondition ?? ''}
                          onChange={(e) => setConfig({
                            ...config,
                            streamConfig: {
                              ...config.streamConfig!,
                              response: {
                                ...config.streamConfig.response!,
                                finishCondition: e.target.value
                              }
                            }
                          })}
                          placeholder="[DONE]"
                          className="h-8 text-xs"
                        />
                      </div>
                    </div>
                    
                    <div>
                      <Label className="text-xs">流式内容路径 *</Label>
                      <Input
                        value={config.streamConfig?.response?.contentPath ?? ''}
                        onChange={(e) => setConfig({
                          ...config,
                          streamConfig: {
                            ...config.streamConfig!,
                            response: {
                              ...config.streamConfig.response!,
                              contentPath: e.target.value
                            }
                          }
                        })}
                        placeholder="choices[0].delta.content"
                        className="h-8 text-xs"
                      />
                    </div>
                    
                    <div>
                      <Label className="text-xs">流式推理内容路径（可选）</Label>
                      <Input
                        value={config.streamConfig?.response?.reasoningPath ?? ''}
                        onChange={(e) => setConfig({
                          ...config,
                          streamConfig: {
                            ...config.streamConfig!,
                            response: {
                              ...config.streamConfig.response!,
                              reasoningPath: e.target.value
                            }
                          }
                        })}
                        placeholder="choices[0].delta.reasoning_content"
                        className="h-8 text-xs"
                      />
                    </div>
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          {/* 响应解析配置 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">响应解析配置</CardTitle>
              <CardDescription>
                配置如何从API响应中提取内容和错误信息
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="content-path">内容提取路径 *</Label>
                <Input
                  id="content-path"
                  value={config.response.contentPath}
                  onChange={(e) => setConfig({
                    ...config,
                    response: {
                      ...config.response,
                      contentPath: e.target.value
                    }
                  })}
                  placeholder="choices[0].message.content"
                />
              </div>

              <div>
                <Label htmlFor="reasoning-path">推理内容路径（可选）</Label>
                <Input
                  id="reasoning-path"
                  value={config.response.reasoningPath ?? ''}
                  onChange={(e) => setConfig({
                    ...config,
                    response: {
                      ...config.response,
                      reasoningPath: e.target.value
                    }
                  })}
                  placeholder="choices[0].message.reasoning_content"
                />
                <p className="text-xs text-muted-foreground mt-1">
                  用于提取推理过程内容，支持推理模式的AI使用
                </p>
              </div>

              <div>
                <Label htmlFor="error-path">错误信息路径（可选）</Label>
                <Input
                  id="error-path"
                  value={config.response.errorConfig?.messagePath ?? ''}
                  onChange={(e) => setConfig({
                    ...config,
                    response: {
                      ...config.response,
                      errorConfig: {
                        messagePath: e.target.value
                      }
                    }
                  })}
                  placeholder="error.message"
                />
              </div>
            </CardContent>
          </Card>

          {/* 模板变量说明 */}
          <Collapsible title="可用模板变量">
            <div className="space-y-2">
              <div className="flex items-center gap-2 mb-2">
                <HelpCircle className="h-4 w-4" />
                <span className="text-sm text-gray-600">在模板中使用 {"{变量名}"} 的格式</span>
              </div>
              <div className="flex flex-wrap gap-2">
                {Object.entries(config.templateVariables || {}).map(([key, desc]) => (
                  <div key={key} title={desc} className="cursor-help">
                    <Chip label={`{${key}}`} />
                  </div>
                ))}
              </div>
            </div>
          </Collapsible>
        </div>

        <DialogFooter>
          <Button onClick={onClose} variant="outline">取消</Button>
          <Button onClick={handleSave} disabled={!provider}>
            保存配置
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default AdvancedProviderConfig; 