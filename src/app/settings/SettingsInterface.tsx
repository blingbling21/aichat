"use client";

import { FC, useState, useEffect } from 'react';
import { Plus, Trash2, Save, Edit, Check, Zap, Loader2, Settings } from 'lucide-react';
import { AIProvider, ProxySettings, AIModel } from '../types';
import { storageService } from '../services/storage';
import { aiService } from '../services/ai';
import { logService } from '../services/log';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Checkbox } from "@/components/ui/checkbox";
import { Label } from "@/components/ui/label";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { toast } from "sonner";

/**
 * 设置界面组件
 * 包含AI提供商管理和代理设置
 */
const SettingsInterface: FC = () => {
  // AI提供商列表状态
  const [providers, setProviders] = useState<AIProvider[]>([]);
  
  // 新提供商表单状态
  const [newProvider, setNewProvider] = useState<AIProvider>({
    id: '',
    name: '',
    apiEndpoint: '',
    apiKey: '',
    models: [],
  });
  
  // 编辑状态跟踪
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
  
  // 代理设置状态
  const [proxySettings, setProxySettings] = useState<ProxySettings>({
    enabled: false,
    host: '',
    port: '',
    requiresAuth: false,
    username: '',
    password: ''
  });
  
  // 删除确认对话框状态
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [providerToDelete, setProviderToDelete] = useState<string | null>(null);
  
  // 测试连接状态
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  
  // 模型管理对话框状态
  const [modelDialogOpen, setModelDialogOpen] = useState(false);
  const [currentProvider, setCurrentProvider] = useState<string | null>(null);
  const [newModel, setNewModel] = useState<AIModel>({
    id: '',
    name: '',
    parameters: {},
  });
  
  // 从存储服务加载设置
  useEffect(() => {
    // 加载AI提供商
    const savedProviders = storageService.getProviders();
    if (savedProviders.length > 0) {
      // 确保所有提供商都有models字段
      const updatedProviders = savedProviders.map(provider => ({
        ...provider,
        models: provider.models || [
          { id: 'default', name: 'Default Model' }
        ]
      }));
      setProviders(updatedProviders);
      logService.info(`已加载 ${savedProviders.length} 个AI提供商`);
    } else {
      // 设置默认提供商
      setProviders([{
        id: '1',
        name: 'ChatGPT',
        apiEndpoint: 'https://api.openai.com/v1/chat/completions',
        apiKey: '',
        models: [
          { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
          { id: 'gpt-4', name: 'GPT-4' }
        ],
        defaultModelId: 'gpt-3.5-turbo'
      }]);
      logService.info('使用默认AI提供商');
    }
    
    // 加载代理设置
    const savedProxy = storageService.getProxySettings();
    setProxySettings(savedProxy);
    logService.info(`已加载代理设置，代理状态: ${savedProxy.enabled ? '启用' : '禁用'}`);
  }, []);
  
  // 添加新的AI提供商
  const handleAddProvider = () => {
    if (!newProvider.name || !newProvider.apiEndpoint) {
      toast.error('提供商名称和API端点不能为空');
      logService.warn('添加提供商失败：名称或API端点为空');
      return;
    }
    
    const newId = Date.now().toString();
    
    // 预设模型列表
    let presetModels: AIModel[] = [];
    
    // 根据提供商名称预设模型
    if (newProvider.name.toLowerCase().includes('openai') || newProvider.name.toLowerCase().includes('chatgpt')) {
      presetModels = [
        { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' },
        { id: 'gpt-4', name: 'GPT-4' },
        { id: 'gpt-4-turbo', name: 'GPT-4 Turbo' }
      ];
    } else if (newProvider.name.toLowerCase().includes('deepseek')) {
      // 使用DeepSeek API文档中指定的标准模型名称
      presetModels = [
        { id: 'deepseek-chat', name: 'DeepSeek-V3' },
        { id: 'deepseek-reasoner', name: 'DeepSeek-R1' }
      ];
      
      // 确保API端点正确
      if (!newProvider.apiEndpoint || !newProvider.apiEndpoint.includes('api.deepseek.com')) {
        newProvider.apiEndpoint = 'https://api.deepseek.com/chat/completions';
        logService.info('自动设置DeepSeek API端点');
      }
    } else if (newProvider.name.toLowerCase().includes('claude') || newProvider.name.toLowerCase().includes('anthropic')) {
      presetModels = [
        { id: 'claude-3-opus-20240229', name: 'Claude 3 Opus' },
        { id: 'claude-3-sonnet-20240229', name: 'Claude 3 Sonnet' },
        { id: 'claude-3-haiku-20240307', name: 'Claude 3 Haiku' }
      ];
    }
    
    const updatedProviders = [...providers, {
      ...newProvider,
      id: newId,
      models: presetModels.length > 0 ? presetModels : [{ id: 'default', name: '默认模型' }],
      defaultModelId: presetModels.length > 0 ? presetModels[0].id : 'default'
    }];
    
    setProviders(updatedProviders);
    storageService.saveProviders(updatedProviders);
    
    logService.info(`已添加新AI提供商: ${newProvider.name}，预设了 ${presetModels.length} 个模型`);
    
    // 重置表单
    setNewProvider({
      id: '',
      name: '',
      apiEndpoint: '',
      apiKey: '',
      models: [],
    });
    
    toast.success('新的AI提供商已添加');
  };
  
  // 切换编辑模式
  const toggleEditMode = (id: string) => {
    if (editingProviderId === id) {
      // 保存更改
      storageService.saveProviders(providers);
      setEditingProviderId(null);
      
      const provider = providers.find(p => p.id === id);
      logService.info(`已更新AI提供商: ${provider?.name}`);
      
      toast.success('AI提供商已更新');
    } else {
      setEditingProviderId(id);
      logService.debug(`开始编辑提供商 ID: ${id}`);
    }
  };
  
  // 打开删除确认对话框
  const openDeleteDialog = (id: string) => {
    setProviderToDelete(id);
    setDeleteDialogOpen(true);
    
    const provider = providers.find(p => p.id === id);
    logService.debug(`准备删除提供商: ${provider?.name}`);
  };
  
  // 删除AI提供商
  const handleDeleteProvider = () => {
    if (!providerToDelete) return;
    
    const providerToRemove = providers.find(p => p.id === providerToDelete);
    const updatedProviders = providers.filter(provider => provider.id !== providerToDelete);
    
    setProviders(updatedProviders);
    storageService.saveProviders(updatedProviders);
    
    logService.info(`已删除AI提供商: ${providerToRemove?.name}`);
    toast.success('AI提供商已删除');
    
    // 关闭对话框并重置状态
    setDeleteDialogOpen(false);
    setProviderToDelete(null);
  };
  
  // 更新现有AI提供商
  const handleUpdateProvider = (id: string, field: keyof AIProvider, value: string) => {
    const updatedProviders = providers.map(provider => 
      provider.id === id ? { ...provider, [field]: value } : provider
    );
    setProviders(updatedProviders);
  };
  
  // 更新代理设置
  const handleUpdateProxy = <T extends keyof ProxySettings>(field: T, value: ProxySettings[T]) => {
    const updatedSettings = { ...proxySettings, [field]: value };
    setProxySettings(updatedSettings);
  };
  
  // 测试API连接
  const handleTestConnection = async (id: string) => {
    setTestingProvider(id);
    
    const provider = providers.find(p => p.id === id);
    logService.info(`测试连接到: ${provider?.name}`);
    
    try {
      const result = await aiService.testConnection(id);
      
      if (result.success) {
        logService.info(`连接测试成功: ${result.message}`);
        toast.success(result.message);
      } else {
        logService.error(`连接测试失败: ${result.message}`);
        toast.error(result.message);
      }
    } catch (error) {
      const errorMsg = `测试连接出错: ${error instanceof Error ? error.message : '未知错误'}`;
      logService.error(errorMsg);
      toast.error(errorMsg);
    } finally {
      setTestingProvider(null);
    }
  };
  
  // 保存所有设置
  const handleSaveSettings = () => {
    // 保存到存储服务
    storageService.saveProviders(providers);
    storageService.saveProxySettings(proxySettings);
    
    // 如果有正在编辑的提供商，退出编辑模式
    if (editingProviderId) {
      setEditingProviderId(null);
    }
    
    logService.info('所有设置已保存');
    logService.debug(`保存了 ${providers.length} 个AI提供商和代理设置(${proxySettings.enabled ? '启用' : '禁用'})`);
    
    toast.success('设置已保存');
  };
  
  // 打开模型管理对话框
  const openModelDialog = (providerId: string) => {
    setCurrentProvider(providerId);
    setModelDialogOpen(true);
    
    const provider = providers.find(p => p.id === providerId);
    logService.debug(`打开提供商 ${provider?.name} 的模型管理`);
  };
  
  // 添加新模型
  const handleAddModel = () => {
    if (!currentProvider || !newModel.name) {
      toast.error('模型名称不能为空');
      return;
    }
    
    const newModelId = Date.now().toString();
    const updatedProviders = providers.map(provider => {
      if (provider.id === currentProvider) {
        // 如果这是第一个添加的模型，设为默认
        const isFirstModel = !provider.models || provider.models.length === 0;
        
        return {
          ...provider,
          models: [
            ...(provider.models || []),
            { ...newModel, id: newModelId }
          ],
          defaultModelId: isFirstModel ? newModelId : provider.defaultModelId
        };
      }
      return provider;
    });
    
    setProviders(updatedProviders);
    storageService.saveProviders(updatedProviders);
    
    // 重置表单
    setNewModel({
      id: '',
      name: '',
      parameters: {}
    });
    
    toast.success('新的模型已添加');
    logService.info(`已添加新模型: ${newModel.name}`);
  };
  
  // 设置默认模型
  const handleSetDefaultModel = (providerId: string, modelId: string) => {
    const updatedProviders = providers.map(provider => {
      if (provider.id === providerId) {
        return { ...provider, defaultModelId: modelId };
      }
      return provider;
    });
    
    setProviders(updatedProviders);
    storageService.saveProviders(updatedProviders);
    
    const provider = providers.find(p => p.id === providerId);
    const model = provider?.models.find(m => m.id === modelId);
    logService.info(`已将 ${model?.name} 设为 ${provider?.name} 的默认模型`);
    
    toast.success('默认模型已更新');
  };
  
  // 删除模型
  const handleDeleteModel = (providerId: string, modelId: string) => {
    const provider = providers.find(p => p.id === providerId);
    if (!provider || provider.models.length <= 1) {
      toast.error('至少保留一个模型');
      return;
    }
    
    // 检查是否删除的是默认模型
    const isDefaultModel = provider.defaultModelId === modelId;
    
    const updatedProviders = providers.map(p => {
      if (p.id === providerId) {
        const updatedModels = p.models.filter(m => m.id !== modelId);
        return {
          ...p,
          models: updatedModels,
          // 如果删除的是默认模型，则选择第一个模型作为新的默认模型
          defaultModelId: isDefaultModel ? updatedModels[0]?.id : p.defaultModelId
        };
      }
      return p;
    });
    
    setProviders(updatedProviders);
    storageService.saveProviders(updatedProviders);
    
    const model = provider.models.find(m => m.id === modelId);
    logService.info(`已删除模型: ${model?.name}`);
    toast.success('模型已删除');
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl h-full overflow-y-auto">
      <h1 className="text-2xl font-bold mb-6">设置</h1>
      
      {/* AI提供商设置 */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>AI提供商</CardTitle>
        </CardHeader>
        <CardContent className="space-y-6">
          {/* 现有AI提供商列表 */}
          <div className="space-y-4">
            {providers.map(provider => (
              <Card key={provider.id} className="border">
                <CardContent className="p-4">
                  <div className="flex justify-between items-center mb-2">
                    <div className="flex items-center gap-2 w-full">
                      {editingProviderId === provider.id ? (
                        <Input
                          type="text"
                          value={provider.name}
                          onChange={(e) => handleUpdateProvider(provider.id, 'name', e.target.value)}
                          className="font-medium flex-1"
                        />
                      ) : (
                        <h3 className="font-medium">{provider.name}</h3>
                      )}
                    </div>
                    <div className="flex items-center gap-2">
                      {editingProviderId === provider.id ? (
                        <Button 
                          onClick={() => toggleEditMode(provider.id)}
                          variant="default"
                          size="sm"
                          className="cursor-pointer"
                        >
                          <Check size={16} />
                          <span className="ml-1">保存</span>
                        </Button>
                      ) : (
                        <>
                          <Button 
                            onClick={() => toggleEditMode(provider.id)}
                            variant="outline"
                            size="sm"
                            className="cursor-pointer"
                          >
                            <Edit size={16} />
                            <span className="ml-1">编辑</span>
                          </Button>
                          <Button 
                            onClick={() => openDeleteDialog(provider.id)}
                            variant="outline"
                            size="sm"
                            className="text-destructive cursor-pointer"
                          >
                            <Trash2 size={16} />
                            <span className="ml-1">删除</span>
                          </Button>
                          <Button 
                            onClick={() => handleTestConnection(provider.id)}
                            variant="outline"
                            size="sm"
                            className="text-blue-500 cursor-pointer"
                            disabled={testingProvider === provider.id || !provider.apiKey}
                          >
                            {testingProvider === provider.id ? (
                              <Loader2 className="h-4 w-4 animate-spin" />
                            ) : (
                              <Zap size={16} />
                            )}
                            <span className="ml-1">测试</span>
                          </Button>
                          <Button 
                            onClick={() => openModelDialog(provider.id)}
                            variant="outline"
                            size="sm"
                            className="text-green-500 cursor-pointer"
                          >
                            <Settings size={16} />
                            <span className="ml-1">模型</span>
                          </Button>
                        </>
                      )}
                    </div>
                  </div>
                  
                  <div className="space-y-2">
                    <div>
                      <Label htmlFor={`api-endpoint-${provider.id}`} className="block mb-1">API端点</Label>
                      <Input
                        id={`api-endpoint-${provider.id}`}
                        type="text"
                        value={provider.apiEndpoint}
                        onChange={(e) => handleUpdateProvider(provider.id, 'apiEndpoint', e.target.value)}
                        disabled={editingProviderId !== provider.id}
                        className={`${editingProviderId !== provider.id ? "opacity-75 bg-muted" : ""}`}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor={`api-key-${provider.id}`} className="block mb-1">API密钥</Label>
                      <Input
                        id={`api-key-${provider.id}`}
                        type={editingProviderId === provider.id ? "text" : "password"}
                        value={provider.apiKey ? (editingProviderId !== provider.id ? "••••••••••••••••" : provider.apiKey) : ""}
                        onChange={(e) => handleUpdateProvider(provider.id, 'apiKey', e.target.value)}
                        disabled={editingProviderId !== provider.id}
                        className={`${editingProviderId !== provider.id ? "opacity-75 bg-muted" : ""}`}
                        placeholder={editingProviderId === provider.id ? "输入API密钥" : ""}
                      />
                    </div>
                    
                    <div>
                      <Label className="block mb-1">默认模型</Label>
                      <div className="text-sm text-gray-500">
                        {provider.models && provider.models.length > 0 ? (
                          provider.models.find(m => m.id === provider.defaultModelId)?.name || 
                          provider.models[0].name
                        ) : (
                          "未设置模型"
                        )}
                      </div>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
          
          {/* 添加新AI提供商表单 */}
          <Card className="border border-dashed">
            <CardContent className="p-4">
              <h3 className="font-medium mb-2">添加新提供商</h3>
              
              <div className="space-y-2">
                <div>
                  <Label htmlFor="new-provider-name" className="block mb-1">名称</Label>
                  <Input
                    id="new-provider-name"
                    type="text"
                    value={newProvider.name}
                    onChange={(e) => setNewProvider({ ...newProvider, name: e.target.value })}
                    placeholder="例如: Claude AI"
                  />
                </div>
                
                <div>
                  <Label htmlFor="new-provider-endpoint" className="block mb-1">API端点</Label>
                  <Input
                    id="new-provider-endpoint"
                    type="text"
                    value={newProvider.apiEndpoint}
                    onChange={(e) => setNewProvider({ ...newProvider, apiEndpoint: e.target.value })}
                    placeholder="例如: https://api.anthropic.com/v1/complete"
                  />
                </div>
                
                <div>
                  <Label htmlFor="new-provider-key" className="block mb-1">API密钥</Label>
                  <Input
                    id="new-provider-key"
                    type="password"
                    value={newProvider.apiKey}
                    onChange={(e) => setNewProvider({ ...newProvider, apiKey: e.target.value })}
                    placeholder="您的API密钥"
                  />
                </div>
                
                <Button
                  onClick={handleAddProvider}
                  className="mt-2 cursor-pointer"
                >
                  <Plus size={16} className="mr-1" />
                  添加提供商
                </Button>
              </div>
            </CardContent>
          </Card>
        </CardContent>
      </Card>
      
      {/* 代理设置 */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>代理设置</CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div className="flex items-center space-x-2">
            <Checkbox 
              id="enable-proxy"
              checked={proxySettings.enabled}
              onCheckedChange={(checked) => handleUpdateProxy('enabled', checked === true)}
              className="cursor-pointer"
            />
            <Label htmlFor="enable-proxy" className="cursor-pointer">启用代理</Label>
          </div>
          
          {proxySettings.enabled && (
            <>
              <div className="flex gap-4">
                <div className="flex-1">
                  <Label htmlFor="proxy-host" className="block mb-1">主机</Label>
                  <Input
                    id="proxy-host"
                    type="text"
                    value={proxySettings.host}
                    onChange={(e) => handleUpdateProxy('host', e.target.value)}
                    placeholder="例如: 127.0.0.1"
                  />
                </div>
                
                <div className="w-1/4">
                  <Label htmlFor="proxy-port" className="block mb-1">端口</Label>
                  <Input
                    id="proxy-port"
                    type="text"
                    value={proxySettings.port}
                    onChange={(e) => handleUpdateProxy('port', e.target.value)}
                    placeholder="例如: 7890"
                  />
                </div>
              </div>
              
              <div className="flex items-center space-x-2">
                <Checkbox
                  id="proxy-auth"
                  checked={proxySettings.requiresAuth}
                  onCheckedChange={(checked) => handleUpdateProxy('requiresAuth', checked === true)}
                  className="cursor-pointer"
                />
                <Label htmlFor="proxy-auth" className="cursor-pointer">需要认证</Label>
              </div>
              
              {proxySettings.requiresAuth && (
                <div className="flex gap-4">
                  <div className="flex-1">
                    <Label htmlFor="proxy-username" className="block mb-1">用户名</Label>
                    <Input
                      id="proxy-username"
                      type="text"
                      value={proxySettings.username}
                      onChange={(e) => handleUpdateProxy('username', e.target.value)}
                    />
                  </div>
                  
                  <div className="flex-1">
                    <Label htmlFor="proxy-password" className="block mb-1">密码</Label>
                    <Input
                      id="proxy-password"
                      type="password"
                      value={proxySettings.password}
                      onChange={(e) => handleUpdateProxy('password', e.target.value)}
                    />
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
      
      {/* 保存按钮 */}
      <div className="flex justify-end mb-6">
        <Button
          onClick={handleSaveSettings}
          className="cursor-pointer"
        >
          <Save size={16} className="mr-2" />
          保存设置
        </Button>
      </div>
      
      {/* 删除确认对话框 */}
      <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>确认删除</DialogTitle>
            <DialogDescription>
              您确定要删除此AI提供商吗？此操作无法撤销。
            </DialogDescription>
          </DialogHeader>
          <DialogFooter>
            <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>取消</Button>
            <Button variant="destructive" onClick={handleDeleteProvider}>删除</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
      
      {/* 模型管理对话框 */}
      <Dialog open={modelDialogOpen} onOpenChange={setModelDialogOpen}>
        <DialogContent className="sm:max-w-[500px]">
          <DialogHeader>
            <DialogTitle>模型管理</DialogTitle>
          </DialogHeader>
          
          {currentProvider && (
            <>
              <div className="space-y-4 my-4">
                <h3 className="font-medium text-sm text-gray-500">现有模型</h3>
                
                {providers.find(p => p.id === currentProvider)?.models.map(model => (
                  <div key={model.id} className="flex items-center justify-between p-2 border rounded-md">
                    <div>
                      <div className="font-medium">{model.name}</div>
                      <div className="text-xs text-gray-500">ID: {model.id}</div>
                    </div>
                    <div className="flex gap-2">
                      {providers.find(p => p.id === currentProvider)?.defaultModelId === model.id ? (
                        <span className="text-xs bg-green-100 text-green-800 px-2 py-1 rounded-full">默认</span>
                      ) : (
                        <Button 
                          variant="outline" 
                          size="sm" 
                          onClick={() => handleSetDefaultModel(currentProvider, model.id)}
                        >
                          设为默认
                        </Button>
                      )}
                      <Button 
                        variant="outline" 
                        size="sm" 
                        className="text-destructive"
                        onClick={() => handleDeleteModel(currentProvider, model.id)}
                        disabled={(providers.find(p => p.id === currentProvider)?.models.length || 0) <= 1}
                      >
                        <Trash2 size={14} />
                      </Button>
                    </div>
                  </div>
                ))}
              </div>
              
              <div className="border-t pt-4">
                <h3 className="font-medium text-sm text-gray-500 mb-2">添加新模型</h3>
                <div className="space-y-2">
                  <div>
                    <Label htmlFor="new-model-name">模型名称</Label>
                    <Input
                      id="new-model-name"
                      value={newModel.name}
                      onChange={(e) => setNewModel({ ...newModel, name: e.target.value })}
                      placeholder="例如: GPT-4 Turbo"
                    />
                  </div>
                  
                  <Button onClick={handleAddModel} className="w-full">
                    <Plus size={16} className="mr-1" />
                    添加模型
                  </Button>
                </div>
              </div>
            </>
          )}
        </DialogContent>
      </Dialog>
    </div>
  );
};

export default SettingsInterface; 