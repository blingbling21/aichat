"use client";

import React, { useState, useEffect, FC } from 'react';
import { Plus, Trash2, Save, Edit, Check, Zap, Loader2, Settings, Wrench, Download, DollarSign } from 'lucide-react';
import { AIProvider, ProxySettings, AIModel, ModelFeatures } from '../types';
import { storageService } from '../services';
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
import AdvancedProviderConfig from '../components/AdvancedProviderConfig';
import APIAutoFetchConfig from '../components/APIAutoFetchConfig';
import BalanceAPIConfig from '../components/BalanceAPIConfig';
import MCPSettings from '../components/MCPSettings';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { httpService } from '../services/http';

/**
 * 设置界面组件
 * 包含AI提供商管理和代理设置
 */
const SettingsInterface: FC = () => {
  // 状态管理
  const [providers, setProviders] = useState<AIProvider[]>([]);
  const [proxySettings, setProxySettings] = useState<ProxySettings>({
    enabled: false,
    type: 'http',
    host: '',
    port: 0,
    requiresAuth: false,
    username: '',
    password: ''
  });
  
  // 新增：提供商编辑对话框状态
  // const [isProviderDialogOpen, setIsProviderDialogOpen] = useState(false);
  // const [editingProvider, setEditingProvider] = useState<AIProvider | null>(null);
  
  // 新增：模型编辑对话框状态
  // const [isModelDialogOpen, setIsModelDialogOpen] = useState(false);
  // const [editingModelProvider, setEditingModelProvider] = useState<AIProvider | null>(null);
  
  // 高级配置对话框状态
  const [advancedConfigOpen, setAdvancedConfigOpen] = useState(false);
  const [selectedProvider, setSelectedProvider] = useState<AIProvider | null>(null);
  
  // API自动获取配置对话框状态
  const [apiAutoFetchConfigOpen, setApiAutoFetchConfigOpen] = useState(false);
  const [selectedProviderForAutoFetch, setSelectedProviderForAutoFetch] = useState<AIProvider | null>(null);
  
  // 定价API配置对话框状态
  const [pricingConfigOpen, setPricingConfigOpen] = useState(false);
  const [selectedProviderForPricing, setSelectedProviderForPricing] = useState<AIProvider | null>(null);
  
  // 新提供商表单状态
  const [newProvider, setNewProvider] = useState<Partial<AIProvider>>({
    id: '',
    name: '',
    apiEndpoint: '',
    apiKey: '',
    models: [],
  });
  
  // 编辑状态跟踪
  const [editingProviderId, setEditingProviderId] = useState<string | null>(null);
  
  // 删除确认对话框状态
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [providerToDelete, setProviderToDelete] = useState<string | null>(null);
  
  // 测试连接状态
  const [testingProvider, setTestingProvider] = useState<string | null>(null);
  
  // 代理测试状态
  const [testingProxy, setTestingProxy] = useState(false);
  
  // 模型管理对话框状态
  const [modelDialogOpen, setModelDialogOpen] = useState(false);
  const [currentProvider, setCurrentProvider] = useState<string>('');
  const [newModel, setNewModel] = useState<Partial<AIModel>>({
    id: '',
    features: {
      reasoning: false,
      image: false,
      video: false,
      voice: false
    }
  });
  
  // 从存储服务加载设置
  useEffect(() => {
    const loadSettings = async () => {
      // 加载AI提供商
      const savedProviders = await storageService.getProviders();
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
            { id: 'gpt-3.5-turbo' },
            { id: 'gpt-4' }
          ],
          defaultModelId: 'gpt-3.5-turbo'
        }]);
        logService.info('使用默认AI提供商');
      }
      
      // 加载代理设置
      const savedProxy = await storageService.getProxySettings();
      setProxySettings(savedProxy);
      logService.info(`已加载代理设置，代理状态: ${savedProxy.enabled ? '启用' : '禁用'}`);
    };
    
    loadSettings();
  }, []);
  
  // 添加新的AI提供商
  const handleAddProvider = () => {
    if (!newProvider.name || !newProvider.apiEndpoint) {
      toast.error('提供商名称和API端点不能为空');
      logService.warn('添加提供商失败：名称或API端点为空');
      return;
    }
    
    const newId = Date.now().toString();
    
    // 创建新提供商，不自动添加任何预设模型
    const newProviderData: AIProvider = {
      id: newId,
      name: newProvider.name!,
      apiEndpoint: newProvider.apiEndpoint!,
      apiKey: newProvider.apiKey || '',
      models: [], // 不添加任何预设模型
      defaultModelId: undefined // 没有默认模型
    };
    
    const updatedProviders = [...providers, newProviderData];
    setProviders(updatedProviders);
    storageService.saveProviders(updatedProviders);
    
    logService.info(`已添加新AI提供商: ${newProvider.name}`);
    
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
  
  // 测试代理连接
  const handleTestProxy = async () => {
    if (!proxySettings.enabled) {
      toast.error('请先启用代理');
      return;
    }

    if (!proxySettings.host || !proxySettings.port) {
      toast.error('请填写代理主机和端口');
      return;
    }

    setTestingProxy(true);
    logService.info(`测试代理连接: ${proxySettings.type}://${proxySettings.host}:${proxySettings.port}`);

    try {
      const result = await httpService.testProxyConnection(proxySettings);
      logService.info(`代理测试成功: ${result}`);
      toast.success(`代理连接成功！${result.includes('ip') ? '获取到外部IP信息' : ''}`);
    } catch (error) {
      const errorMsg = `代理测试失败: ${error instanceof Error ? error.message : '未知错误'}`;
      logService.error(errorMsg);
      toast.error(errorMsg);
    } finally {
      setTestingProxy(false);
    }
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
    if (!currentProvider || !newModel.id) {
      toast.error('模型ID不能为空');
      return;
    }
    
    // 检查模型ID是否已存在
    const provider = providers.find(p => p.id === currentProvider);
    if (provider?.models.some(m => m.id === newModel.id)) {
      toast.error('模型ID已存在，请使用不同的ID');
      return;
    }
    
    const updatedProviders = providers.map(provider => {
      if (provider.id === currentProvider) {
        // 如果这是第一个添加的模型，设为默认
        const isFirstModel = !provider.models || provider.models.length === 0;
        
        // 创建新模型，使用用户输入的ID
        const newModelData: AIModel = {
          id: newModel.id!,
          parameters: newModel.parameters,
          features: newModel.features || {
            reasoning: false,
            image: false,
            video: false,
            voice: false
          }
        };
        
        return {
          ...provider,
          models: [
            ...(provider.models || []),
            newModelData
          ],
          defaultModelId: isFirstModel ? newModel.id : provider.defaultModelId
        };
      }
      return provider;
    });
    
    setProviders(updatedProviders);
    storageService.saveProviders(updatedProviders);
    
    // 重置表单
    setNewModel({
      id: '',
      features: {
        reasoning: false,
        image: false,
        video: false,
        voice: false
      }
    });
    
    toast.success('新的模型已添加');
    logService.info(`已添加新模型: ${newModel.id} (ID: ${newModel.id})`);
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
    logService.info(`已将 ${model?.id} 设为 ${provider?.name} 的默认模型`);
    
    toast.success('默认模型已更新');
  };
  
  // 删除模型
  const handleDeleteModel = (providerId: string, modelId: string) => {
    const provider = providers.find(p => p.id === providerId);
    if (!provider) {
      toast.error('找不到提供商');
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
          // 如果删除的是默认模型，重新设置默认模型
          defaultModelId: isDefaultModel 
            ? (updatedModels.length > 0 ? updatedModels[0].id : undefined)
            : p.defaultModelId
        };
      }
      return p;
    });
    
    setProviders(updatedProviders);
    storageService.saveProviders(updatedProviders);
    
    const model = provider.models.find(m => m.id === modelId);
    logService.info(`已删除模型: ${model?.id}`);
    toast.success('模型已删除');
  };

  // 更新模型的功能支持
  const handleFeatureChange = (providerId: string, modelId: string, feature: keyof ModelFeatures, value: boolean) => {
    const updatedProviders = providers.map(provider => {
      if (provider.id === providerId) {
        const updatedModels = provider.models.map(model => {
          if (model.id === modelId) {
            return {
              ...model,
              features: {
                ...(model.features || {}),
                [feature]: value
              }
            };
          }
          return model;
        });
        return {
          ...provider,
          models: updatedModels
        };
      }
      return provider;
    });
    
    setProviders(updatedProviders);
    storageService.saveProviders(updatedProviders);
    
    const provider = providers.find(p => p.id === providerId);
    const model = provider?.models.find(m => m.id === modelId);
    logService.info(`已更新模型 ${model?.id} 的 ${feature} 功能: ${value}`);
  };

  // 新增：打开高级配置对话框
  const handleAdvancedConfig = (providerId: string) => {
    const provider = providers.find(p => p.id === providerId);
    if (provider) {
      setSelectedProvider(provider);
      setAdvancedConfigOpen(true);
    }
  };

  // 新增：保存高级配置
  const handleAdvancedConfigSave = (updatedProvider: AIProvider) => {
    const updatedProviders = providers.map(p => 
      p.id === updatedProvider.id ? updatedProvider : p
    );
    storageService.saveProviders(updatedProviders);
    setProviders(updatedProviders);
    setAdvancedConfigOpen(false);
    setSelectedProvider(null);
  };

  // 新增：打开API自动获取配置对话框
  const handleApiAutoFetchConfig = (providerId: string) => {
    const provider = providers.find(p => p.id === providerId);
    if (provider) {
      setSelectedProviderForAutoFetch(provider);
      setApiAutoFetchConfigOpen(true);
    }
  };

  // 新增：保存API自动获取配置
  const handleApiAutoFetchConfigSave = (updatedProvider: AIProvider) => {
    const updatedProviders = providers.map(p => 
      p.id === updatedProvider.id ? updatedProvider : p
    );
    storageService.saveProviders(updatedProviders);
    setProviders(updatedProviders);
    setApiAutoFetchConfigOpen(false);
    setSelectedProviderForAutoFetch(null);
  };

  // 新增：打开定价API配置对话框
  const handlePricingConfig = (providerId: string) => {
    const provider = providers.find(p => p.id === providerId);
    if (provider) {
      setSelectedProviderForPricing(provider);
      setPricingConfigOpen(true);
    }
  };

  // 新增：保存定价API配置
  const handlePricingConfigSave = (updatedProvider: AIProvider) => {
    const updatedProviders = providers.map(p => 
      p.id === updatedProvider.id ? updatedProvider : p
    );
    storageService.saveProviders(updatedProviders);
    setProviders(updatedProviders);
    // 注意：不关闭弹出框，让BalanceAPIConfig组件内部处理页面切换
  };

  return (
    <div className="container mx-auto p-6 max-w-4xl">
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
                  <div className="mb-3">
                    <div className="flex items-center justify-between gap-2 mb-2">
                      {editingProviderId === provider.id ? (
                        <div className="flex items-center gap-2 flex-1">
                          <Input
                            type="text"
                            value={provider.name}
                            onChange={(e) => handleUpdateProvider(provider.id, 'name', e.target.value)}
                            className="font-medium flex-1"
                          />
                          <Button 
                            onClick={() => toggleEditMode(provider.id)}
                            variant="default"
                            size="sm"
                            className="cursor-pointer whitespace-nowrap"
                          >
                            <Check size={16} />
                            <span className="ml-1">保存</span>
                          </Button>
                        </div>
                      ) : (
                        <h3 className="font-medium">{provider.name}</h3>
                      )}
                    </div>
                    {editingProviderId !== provider.id && (
                      <div className="flex flex-wrap items-center gap-2 mt-2">
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
                        <Button 
                          onClick={() => handlePricingConfig(provider.id)}
                          variant="outline"
                          size="sm"
                          className="text-orange-500 cursor-pointer"
                        >
                          <DollarSign size={16} />
                          <span className="ml-1">余额</span>
                        </Button>
                        <Button 
                          onClick={() => handleAdvancedConfig(provider.id)}
                          variant="outline"
                          size="sm"
                          className="text-purple-500 cursor-pointer"
                        >
                          <Wrench size={16} />
                          <span className="ml-1">高级</span>
                        </Button>
                      </div>
                    )}
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
                        {provider.defaultModelId ? (
                          provider.models?.find(m => m.id === provider.defaultModelId)?.id || "未找到模型"
                        ) : (
                          "未设置默认模型"
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
              
              <div className="mt-4 pt-4 border-t">
                <div className="grid grid-cols-2 gap-2">
                  <Button
                    onClick={handleAddProvider}
                    variant="outline"
                    className="cursor-pointer whitespace-nowrap"
                  >
                    <Plus size={16} className="mr-1" />
                    添加提供商
                  </Button>
                  
                  {/* 保存AI提供商设置按钮 */}
                  <Button
                    onClick={() => {
                      // 只保存AI提供商设置
                      storageService.saveProviders(providers);
                      
                      // 如果有正在编辑的提供商，退出编辑模式
                      if (editingProviderId) {
                        setEditingProviderId(null);
                      }
                      
                      logService.info('AI提供商设置已保存');
                      logService.debug(`保存了 ${providers.length} 个AI提供商`);
                      
                      toast.success('AI提供商设置已保存');
                    }}
                    className="cursor-pointer whitespace-nowrap"
                  >
                    <Save size={16} className="mr-2" />
                    保存设置
                  </Button>
                </div>
              </div>
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
              <div className="mb-4">
                <Label htmlFor="proxy-type" className="block mb-1">代理类型</Label>
                <Select
                  value={proxySettings.type}
                  onValueChange={(value: 'http' | 'https' | 'socks5') => handleUpdateProxy('type', value)}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="http">HTTP</SelectItem>
                    <SelectItem value="https">HTTPS</SelectItem>
                    <SelectItem value="socks5">SOCKS5</SelectItem>
                  </SelectContent>
                </Select>

              </div>
              
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
                    type="number"
                    value={proxySettings.port.toString()}
                    onChange={(e) => {
                      const port = parseInt(e.target.value) || 0;
                      handleUpdateProxy('port', port);
                    }}
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
              
              {/* 测试代理连接按钮 */}
              <div className="mt-4 pt-4 border-t">
                <Button
                  onClick={handleTestProxy}
                  disabled={!proxySettings.enabled || !proxySettings.host || !proxySettings.port || testingProxy}
                  variant="outline"
                  className="w-full cursor-pointer mb-2"
                >
                  {testingProxy ? (
                    <>
                      <div className="w-4 h-4 border-2 border-gray-300 border-t-blue-600 rounded-full animate-spin mr-2" />
                      测试中...
                    </>
                  ) : (
                    '测试代理连接'
                  )}
                </Button>
              </div>
            </>
          )}
          
          {/* 保存代理设置按钮 - 始终显示 */}
          <div className={`${proxySettings.enabled ? '' : 'mt-4 pt-4 border-t'}`}>
            <Button
              onClick={() => {
                storageService.saveProxySettings(proxySettings);
                toast.success('代理设置已保存');
                logService.info('代理设置已保存');
              }}
              className="w-full cursor-pointer"
            >
              <Save size={16} className="mr-2" />
              保存代理设置
            </Button>
          </div>
        </CardContent>
      </Card>
      
      {/* MCP工具设置 */}
      <Card className="mb-8">
        <CardHeader>
          <CardTitle>MCP工具</CardTitle>
        </CardHeader>
        <CardContent>
          <MCPSettings />
        </CardContent>
      </Card>
      
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
        <DialogContent className="sm:max-w-[600px] max-h-[85vh] flex flex-col overflow-hidden">
          <DialogHeader className="flex-shrink-0">
            <DialogTitle className="flex items-center justify-between pr-8">
              <span>模型管理</span>
              <Button 
                onClick={() => handleApiAutoFetchConfig(currentProvider)}
                variant="outline"
                size="sm"
                className="text-blue-500"
              >
                <Download size={16} />
                <span className="ml-1">API获取</span>
              </Button>
            </DialogTitle>
          </DialogHeader>
          
          {currentProvider && (
            <div className="flex flex-col min-h-0 flex-1 overflow-hidden">
              <div className="flex flex-col min-h-0 flex-1 py-4">
                <h3 className="font-medium text-sm text-gray-500 mb-4 flex-shrink-0">现有模型</h3>
                
                {providers.find(p => p.id === currentProvider)?.models.length === 0 ? (
                  <div className="text-center py-8 text-gray-500 flex-shrink-0">
                    <div className="text-sm">暂无模型</div>
                    <div className="text-xs mt-1">请在下方添加新模型，或点击右上角的&ldquo;API获取&rdquo;按钮自动获取</div>
                  </div>
                ) : (
                  <div className="space-y-3 overflow-y-auto flex-1 min-h-0 pr-2">
                    {providers.find(p => p.id === currentProvider)?.models.map(model => (
                      <div key={model.id} className="p-3 border rounded-md space-y-2">
                        <div className="flex items-center justify-between">
                          <div className="flex-1 min-w-0">
                            <div className="font-medium truncate">{model.id}</div>
                            <div className="text-xs text-gray-500">ID: {model.id}</div>
                          </div>
                          <div className="flex gap-2 items-center flex-shrink-0">
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
                            >
                              <Trash2 size={14} />
                            </Button>
                          </div>
                        </div>
                        
                        <div className="border-t pt-2">
                          <div className="flex items-center justify-between mb-2">
                            <h4 className="text-sm font-medium">支持的功能</h4>
                            <div className="flex items-center gap-4">
                              <div className="flex items-center space-x-1">
                                <Checkbox 
                                  id={`reasoning-${model.id}`}
                                  checked={model.features?.reasoning || false}
                                  onCheckedChange={(checked) => 
                                    handleFeatureChange(currentProvider, model.id, 'reasoning', checked === true)
                                  }
                                />
                                <Label htmlFor={`reasoning-${model.id}`} className="text-xs">推理</Label>
                              </div>
                              <div className="flex items-center space-x-1">
                                <Checkbox 
                                  id={`image-${model.id}`}
                                  checked={model.features?.image || false}
                                  onCheckedChange={(checked) => 
                                    handleFeatureChange(currentProvider, model.id, 'image', checked === true)
                                  }
                                />
                                <Label htmlFor={`image-${model.id}`} className="text-xs">图片</Label>
                              </div>
                              <div className="flex items-center space-x-1">
                                <Checkbox 
                                  id={`video-${model.id}`}
                                  checked={model.features?.video || false}
                                  onCheckedChange={(checked) => 
                                    handleFeatureChange(currentProvider, model.id, 'video', checked === true)
                                  }
                                />
                                <Label htmlFor={`video-${model.id}`} className="text-xs">视频</Label>
                              </div>
                              <div className="flex items-center space-x-1">
                                <Checkbox 
                                  id={`voice-${model.id}`}
                                  checked={model.features?.voice || false}
                                  onCheckedChange={(checked) => 
                                    handleFeatureChange(currentProvider, model.id, 'voice', checked === true)
                                  }
                                />
                                <Label htmlFor={`voice-${model.id}`} className="text-xs">语音</Label>
                              </div>
                            </div>
                          </div>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
              
              <div className="border-t pt-3 flex-shrink-0 bg-white">
                <h3 className="font-medium text-sm text-gray-500 mb-3">添加新模型</h3>
                <div className="space-y-3">
                  <div className="flex flex-col gap-3">
                    <div className="flex items-center gap-3">
                      <Label htmlFor="new-model-id" className="text-sm font-medium whitespace-nowrap">模型ID</Label>
                      <Input
                        id="new-model-id"
                        value={newModel.id}
                        onChange={(e) => setNewModel({ ...newModel, id: e.target.value })}
                        placeholder="例如: deepseek-chat, gpt-4, claude-3-sonnet-20240229"
                        className="flex-1"
                      />
                    </div>
                    
                    <div className="flex items-center gap-3">
                      <Label className="text-sm font-medium whitespace-nowrap">支持的功能</Label>
                      <div className="flex items-center gap-4 flex-1">
                        <div className="flex items-center space-x-1">
                          <Checkbox 
                            id="new-reasoning"
                            checked={newModel.features?.reasoning || false}
                            onCheckedChange={(checked) => 
                              setNewModel({
                                ...newModel,
                                features: {
                                  ...(newModel.features || {}),
                                  reasoning: checked === true
                                }
                              })
                            }
                          />
                          <Label htmlFor="new-reasoning" className="text-xs">推理</Label>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Checkbox 
                            id="new-image"
                            checked={newModel.features?.image || false}
                            onCheckedChange={(checked) => 
                              setNewModel({
                                ...newModel,
                                features: {
                                  ...(newModel.features || {}),
                                  image: checked === true
                                }
                              })
                            }
                          />
                          <Label htmlFor="new-image" className="text-xs">图片</Label>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Checkbox 
                            id="new-video"
                            checked={newModel.features?.video || false}
                            onCheckedChange={(checked) => 
                              setNewModel({
                                ...newModel,
                                features: {
                                  ...(newModel.features || {}),
                                  video: checked === true
                                }
                              })
                            }
                          />
                          <Label htmlFor="new-video" className="text-xs">视频</Label>
                        </div>
                        <div className="flex items-center space-x-1">
                          <Checkbox 
                            id="new-voice"
                            checked={newModel.features?.voice || false}
                            onCheckedChange={(checked) => 
                              setNewModel({
                                ...newModel,
                                features: {
                                  ...(newModel.features || {}),
                                  voice: checked === true
                                }
                              })
                            }
                          />
                          <Label htmlFor="new-voice" className="text-xs">语音</Label>
                        </div>
                      </div>
                    </div>
                  </div>
                  
                  <Button onClick={handleAddModel} className="w-full" disabled={!newModel.id}>
                    <Plus size={16} className="mr-1" />
                    添加模型
                  </Button>
                </div>
              </div>
            </div>
          )}
        </DialogContent>
      </Dialog>

      {/* 高级配置对话框 */}
      <AdvancedProviderConfig
        open={advancedConfigOpen}
        onClose={() => setAdvancedConfigOpen(false)}
        provider={selectedProvider}
        onSave={handleAdvancedConfigSave}
      />

      {/* API自动获取配置对话框 */}
      <APIAutoFetchConfig
        open={apiAutoFetchConfigOpen}
        onClose={() => setApiAutoFetchConfigOpen(false)}
        provider={selectedProviderForAutoFetch}
        onSave={handleApiAutoFetchConfigSave}
      />

      {/* 账户余额API配置对话框 */}
      <BalanceAPIConfig
        open={pricingConfigOpen}
        onClose={() => setPricingConfigOpen(false)}
        provider={selectedProviderForPricing}
        onSave={handlePricingConfigSave}
      />
    </div>
  );
};

export default SettingsInterface; 