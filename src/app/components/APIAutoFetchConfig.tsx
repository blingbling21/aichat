"use client";

import React, { useState, useEffect } from 'react';
import { AIProvider, APIHeaderConfig, type APIAutoFetchConfig } from '../types';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { 
  Plus, 
  Trash2, 
  Download,
  RefreshCw,
  Settings,
  TestTube
} from 'lucide-react';
import { toast } from 'sonner';
import { apiAutoFetchService } from '../services/apiAutoFetch';
import { logService } from '../services/log';

interface APIAutoFetchConfigProps {
  open: boolean;
  onClose: () => void;
  provider: AIProvider | null;
  onSave: (provider: AIProvider) => void;
}

const APIAutoFetchConfig: React.FC<APIAutoFetchConfigProps> = ({
  open,
  onClose,
  provider,
  onSave
}) => {
  const [config, setConfig] = useState<APIAutoFetchConfig>({});
  const [testingModels, setTestingModels] = useState(false);

  // 初始化配置
  useEffect(() => {
    if (provider) {
      setConfig(provider.autoFetchConfig || {});
    }
  }, [provider]);

  // 应用预设配置
  const applyPreset = (presetType: string) => {
    const presets = apiAutoFetchService.getPresetConfigs();
    const preset = presets[presetType];
    
    if (preset) {
      setConfig(preset);
      toast.success(`已应用 ${presetType.toUpperCase()} 预设配置`);
    }
  };

  // 测试模型API
  const testModelsAPI = async () => {
    if (!provider || !config.modelsApi?.enabled) {
      toast.error('请先配置并启用模型API');
      return;
    }

    setTestingModels(true);
    
    try {
      const testProvider = { ...provider, autoFetchConfig: config };
      const models = await apiAutoFetchService.fetchModels(testProvider);
      
      toast.success(`测试成功！获取到 ${models.length} 个模型`);
      logService.info(`模型API测试成功: ${models.map(m => m.id).join(', ')}`);
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      toast.error(`模型API测试失败: ${errorMsg}`);
      logService.error('模型API测试失败', error);
    } finally {
      setTestingModels(false);
    }
  };

  // 立即获取模型
  const fetchModelsNow = async () => {
    if (!provider || !config.modelsApi?.enabled) {
      toast.error('请先配置并启用模型API');
      return;
    }

    try {
      const testProvider = { ...provider, autoFetchConfig: config };
      const models = await apiAutoFetchService.fetchModels(testProvider);
      
      // 更新提供商的模型列表
      const updatedProvider: AIProvider = {
        ...provider,
        models: models,
        autoFetchConfig: apiAutoFetchService.updateLastUpdateTime({ ...provider, autoFetchConfig: config }).autoFetchConfig
      };
      
      onSave(updatedProvider);
      toast.success(`成功获取 ${models.length} 个模型并已保存`);
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      toast.error(`获取模型失败: ${errorMsg}`);
    }
  };

  // 添加请求头
  const addHeader = (apiType: 'models') => {
    if (apiType === 'models') {
      setConfig({
        ...config,
        modelsApi: {
          ...config.modelsApi,
          headers: [...(config.modelsApi?.headers || []), { key: '', value: '', valueType: 'static' as const }]
        }
      });
    }
  };

  // 更新请求头
  const updateHeader = (apiType: 'models', index: number, field: keyof APIHeaderConfig, value: string) => {
    if (apiType === 'models') {
      const newHeaders = [...(config.modelsApi?.headers || [])];
      newHeaders[index] = { ...newHeaders[index], [field]: value };
      setConfig({
        ...config,
        modelsApi: { ...config.modelsApi, headers: newHeaders }
      });
    }
  };

  // 移除请求头
  const removeHeader = (apiType: 'models', index: number) => {
    if (apiType === 'models') {
      setConfig({
        ...config,
        modelsApi: {
          ...config.modelsApi,
          headers: config.modelsApi?.headers?.filter((_, i) => i !== index) || []
        }
      });
    }
  };

  // 保存配置
  const handleSave = () => {
    if (!provider) return;

    const updatedProvider: AIProvider = {
      ...provider,
      autoFetchConfig: config
    };

    onSave(updatedProvider);
    onClose();
    toast.success('API自动获取配置已保存');
  };

  if (!provider) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[85vw] w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Settings size={20} />
            API自动获取配置 - {provider.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {/* 预设配置 */}
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">快速配置</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex gap-2 flex-wrap">
                <Button onClick={() => applyPreset('openai')} variant="outline" size="sm">
                  OpenAI 预设
                </Button>
                <Button onClick={() => applyPreset('gemini')} variant="outline" size="sm">
                  Gemini 预设
                </Button>
                <Button onClick={() => applyPreset('anthropic')} variant="outline" size="sm">
                  Anthropic 预设
                </Button>
                <Button onClick={() => applyPreset('deepseek')} variant="outline" size="sm">
                  DeepSeek 预设
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* 模型API配置 */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center justify-between">
                <span>模型列表API配置</span>
                <div className="flex gap-2">
                  <Button 
                    onClick={testModelsAPI} 
                    disabled={testingModels || !config.modelsApi?.enabled}
                    variant="outline" 
                    size="sm"
                  >
                    {testingModels ? (
                      <RefreshCw size={14} className="animate-spin mr-1" />
                    ) : (
                      <TestTube size={14} className="mr-1" />
                    )}
                    测试API
                  </Button>
                  <Button 
                    onClick={fetchModelsNow} 
                    disabled={!config.modelsApi?.enabled}
                    variant="outline" 
                    size="sm"
                  >
                    <Download size={14} className="mr-1" />
                    立即获取
                  </Button>
                </div>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="models-enabled"
                  checked={config.modelsApi?.enabled || false}
                  onCheckedChange={(checked) => setConfig({
                    ...config,
                    modelsApi: { ...config.modelsApi, enabled: checked === true }
                  })}
                />
                <Label htmlFor="models-enabled">启用模型API自动获取</Label>
              </div>

              {config.modelsApi?.enabled && (
                <>
                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <Label>API端点</Label>
                      <Input
                        value={config.modelsApi?.endpoint || ''}
                        onChange={(e) => setConfig({
                          ...config,
                          modelsApi: { ...config.modelsApi, endpoint: e.target.value }
                        })}
                        placeholder="https://api.example.com/v1/models"
                        className="w-full"
                      />
                    </div>
                    <div>
                      <Label>请求方法</Label>
                      <Select
                        value={config.modelsApi?.method || 'GET'}
                        onValueChange={(value: 'GET' | 'POST') => setConfig({
                          ...config,
                          modelsApi: { ...config.modelsApi, method: value }
                        })}
                      >
                        <SelectTrigger>
                          <SelectValue />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="GET">GET</SelectItem>
                          <SelectItem value="POST">POST</SelectItem>
                        </SelectContent>
                      </Select>
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <Label>响应路径</Label>
                      <Input
                        value={config.modelsApi?.responsePath || ''}
                        onChange={(e) => setConfig({
                          ...config,
                          modelsApi: { ...config.modelsApi, responsePath: e.target.value }
                        })}
                        placeholder="models"
                        className="w-full"
                      />
                    </div>
                    <div>
                      <Label>模型ID路径</Label>
                      <Input
                        value={config.modelsApi?.modelIdPath || ''}
                        onChange={(e) => setConfig({
                          ...config,
                          modelsApi: { ...config.modelsApi, modelIdPath: e.target.value }
                        })}
                        placeholder="name"
                        className="w-full"
                      />
                    </div>
                  </div>

                  <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                    <div>
                      <Label>模型名称路径</Label>
                      <Input
                        value={config.modelsApi?.modelNamePath || ''}
                        onChange={(e) => setConfig({
                          ...config,
                          modelsApi: { ...config.modelsApi, modelNamePath: e.target.value }
                        })}
                        placeholder="displayName"
                        className="w-full"
                      />
                    </div>
                    <div>
                      <Label>过滤规则(正则)</Label>
                      <Input
                        value={config.modelsApi?.filterPattern || ''}
                        onChange={(e) => setConfig({
                          ...config,
                          modelsApi: { ...config.modelsApi, filterPattern: e.target.value }
                        })}
                        placeholder="^models/(gemini|chat)"
                        className="w-full"
                      />
                    </div>
                  </div>

                  {/* 请求头配置 */}
                  <div>
                    <div className="flex items-center justify-between mb-2">
                      <Label>请求头</Label>
                      <Button 
                        onClick={() => addHeader('models')} 
                        variant="outline" 
                        size="sm"
                      >
                        <Plus size={14} className="mr-1" />
                        添加
                      </Button>
                    </div>
                    {config.modelsApi?.headers?.map((header, index) => (
                      <div key={index} className="flex gap-2 mb-2">
                        <Input
                          placeholder="键名 (如: Authorization)"
                          value={header.key}
                          onChange={(e) => updateHeader('models', index, 'key', e.target.value)}
                          className="flex-1"
                        />
                        <Input
                          placeholder="值 (如: Bearer token)"
                          value={header.value}
                          onChange={(e) => updateHeader('models', index, 'value', e.target.value)}
                          className="flex-1"
                        />
                        <Input
                          placeholder="模板 (如: Bearer {apiKey})"
                          value={header.valueTemplate || ''}
                          onChange={(e) => updateHeader('models', index, 'valueTemplate', e.target.value)}
                          className="flex-1"
                        />
                        <Button 
                          onClick={() => removeHeader('models', index)} 
                          variant="outline" 
                          size="sm"
                        >
                          <Trash2 size={14} />
                        </Button>
                      </div>
                    ))}
                  </div>
                </>
              )}
            </CardContent>
          </Card>

          {/* 自动更新设置 */}
          <Card>
            <CardHeader>
              <CardTitle>自动更新设置</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex items-center space-x-2">
                <Checkbox 
                  id="auto-update-enabled"
                  checked={config.autoUpdate?.enabled || false}
                  onCheckedChange={(checked) => setConfig({
                    ...config,
                    autoUpdate: { ...config.autoUpdate, enabled: checked === true }
                  })}
                />
                <Label htmlFor="auto-update-enabled">启用自动更新</Label>
              </div>

              {config.autoUpdate?.enabled && (
                <div>
                  <Label>更新间隔 (小时)</Label>
                  <Input
                    type="number"
                    min="1"
                    max="168"
                    value={config.autoUpdate?.intervalHours || 24}
                    onChange={(e) => setConfig({
                      ...config,
                      autoUpdate: { 
                        ...config.autoUpdate, 
                        intervalHours: parseInt(e.target.value) || 24 
                      }
                    })}
                    className="w-32"
                  />
                  <div className="text-sm text-gray-500 mt-1">
                    建议设置为24小时，避免频繁请求API
                  </div>
                </div>
              )}

              {config.autoUpdate?.lastUpdateTime && (
                <div className="text-sm text-gray-500">
                  上次更新: {new Date(config.autoUpdate.lastUpdateTime).toLocaleString()}
                </div>
              )}
            </CardContent>
          </Card>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>
            取消
          </Button>
          <Button onClick={handleSave}>
            保存配置
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default APIAutoFetchConfig; 