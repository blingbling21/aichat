"use client";

import { FC, useState, useEffect } from 'react';
import { Plus, Trash2, Save, Edit, Check, Zap, Loader2 } from 'lucide-react';
import { AIProvider, ProxySettings } from '../types';
import { storageService } from '../services/storage';
import { aiService } from '../services/ai';
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
    apiKey: ''
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
  
  // 从存储服务加载设置
  useEffect(() => {
    // 加载AI提供商
    const savedProviders = storageService.getProviders();
    if (savedProviders.length > 0) {
      setProviders(savedProviders);
    } else {
      // 设置默认提供商
      setProviders([{
        id: '1',
        name: 'ChatGPT',
        apiEndpoint: 'https://api.openai.com/v1/chat/completions',
        apiKey: ''
      }]);
    }
    
    // 加载代理设置
    const savedProxy = storageService.getProxySettings();
    setProxySettings(savedProxy);
  }, []);
  
  // 添加新的AI提供商
  const handleAddProvider = () => {
    if (!newProvider.name || !newProvider.apiEndpoint) {
      toast.error('提供商名称和API端点不能为空');
      return;
    }
    
    const newId = Date.now().toString();
    const updatedProviders = [...providers, {
      ...newProvider,
      id: newId
    }];
    
    setProviders(updatedProviders);
    storageService.saveProviders(updatedProviders);
    
    // 重置表单
    setNewProvider({
      id: '',
      name: '',
      apiEndpoint: '',
      apiKey: ''
    });
    
    toast.success('新的AI提供商已添加');
  };
  
  // 切换编辑模式
  const toggleEditMode = (id: string) => {
    if (editingProviderId === id) {
      // 保存更改
      storageService.saveProviders(providers);
      setEditingProviderId(null);
      toast.success('AI提供商已更新');
    } else {
      setEditingProviderId(id);
    }
  };
  
  // 打开删除确认对话框
  const openDeleteDialog = (id: string) => {
    setProviderToDelete(id);
    setDeleteDialogOpen(true);
  };
  
  // 删除AI提供商
  const handleDeleteProvider = () => {
    if (!providerToDelete) return;
    
    const updatedProviders = providers.filter(provider => provider.id !== providerToDelete);
    setProviders(updatedProviders);
    storageService.saveProviders(updatedProviders);
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
    
    try {
      const result = await aiService.testConnection(id);
      
      if (result.success) {
        toast.success(result.message);
      } else {
        toast.error(result.message);
      }
    } catch (error) {
      toast.error(`测试连接出错: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setTestingProvider(null);
    }
  };
  
  // 保存所有设置
  const handleSaveSettings = () => {
    // 保存到存储服务
    storageService.saveProviders(providers);
    storageService.saveProxySettings(proxySettings);
    
    toast.success('设置已保存');
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
                          </Button>
                          <Button 
                            onClick={() => openDeleteDialog(provider.id)}
                            variant="outline"
                            size="sm"
                            className="text-destructive cursor-pointer"
                          >
                            <Trash2 size={16} />
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
                        disabled={editingProviderId !== provider.id && editingProviderId !== null}
                        className={editingProviderId !== provider.id && editingProviderId !== null ? "opacity-75" : ""}
                      />
                    </div>
                    
                    <div>
                      <Label htmlFor={`api-key-${provider.id}`} className="block mb-1">API密钥</Label>
                      <Input
                        id={`api-key-${provider.id}`}
                        type="password"
                        value={provider.apiKey}
                        onChange={(e) => handleUpdateProvider(provider.id, 'apiKey', e.target.value)}
                        disabled={editingProviderId !== provider.id && editingProviderId !== null}
                        className={editingProviderId !== provider.id && editingProviderId !== null ? "opacity-75" : ""}
                      />
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
    </div>
  );
};

export default SettingsInterface; 