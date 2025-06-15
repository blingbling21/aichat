import React, { useState, useEffect } from 'react';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { TestTube, RefreshCw, Plus, Trash2, Wallet } from 'lucide-react';
import { toast } from 'sonner';
import { AIProvider, APIAutoFetchConfig, APIHeaderConfig, BalanceResponseField } from '@/app/types';
import { logService } from '@/app/services/log';
import { apiAutoFetchService } from '@/app/services/apiAutoFetch';

interface BalanceAPIConfigProps {
  open: boolean;
  onClose: () => void;
  provider: AIProvider | null;
  onSave: (provider: AIProvider) => void;
}

const BalanceAPIConfig: React.FC<BalanceAPIConfigProps> = ({
  open,
  onClose,
  provider,
  onSave
}) => {
  const [config, setConfig] = useState<APIAutoFetchConfig>({});
  const [testingBalance, setTestingBalance] = useState(false);
  const [showConfigForm, setShowConfigForm] = useState(false);
  const [balanceInfo, setBalanceInfo] = useState<Record<string, unknown> | null>(null);
  const [loadingBalance, setLoadingBalance] = useState(false);

  // 初始化配置
  useEffect(() => {
    if (provider) {
      setConfig(provider.autoFetchConfig || {});
    }
  }, [provider]);

  // 监听provider的autoFetchConfig变化，确保配置同步
  useEffect(() => {
    if (provider?.autoFetchConfig) {
      setConfig(provider.autoFetchConfig);
    }
  }, [provider?.autoFetchConfig]);

  // 当对话框关闭时清理状态
  useEffect(() => {
    if (!open) {
      setBalanceInfo(null);
      setShowConfigForm(false);
    }
  }, [open]);

  // 检查是否已配置API并自动获取余额
  useEffect(() => {
    if (open && provider) {
      if (provider.autoFetchConfig?.balanceApi?.enabled && provider.autoFetchConfig?.balanceApi?.endpoint) {
        // 如果已配置且有API端点，自动获取余额信息
        fetchBalanceInfo();
        setShowConfigForm(false);
      } else {
        // 如果未配置或配置不完整，显示配置表单
        setShowConfigForm(true);
        setBalanceInfo(null);
        
        // 只有在完全没有balanceApi配置的情况下才添加默认字段
        if (!provider.autoFetchConfig?.balanceApi) {
          setConfig(prevConfig => ({
            ...prevConfig,
            balanceApi: {
              enabled: false,
              endpoint: '',
              method: 'GET',
              responsePath: '',
              responseFields: [
                { fieldPath: 'balance_infos[0].total_balance', displayName: '账户余额' },
                { fieldPath: 'balance_infos[0].currency', displayName: '货币类型' },
                { fieldPath: 'is_available', displayName: '账户状态' }
              ],
              headers: []
            }
          }));
        }
      }
    }
  }, [open, provider]);

  // 获取余额信息
  const fetchBalanceInfo = async () => {
    if (!provider) {
      return;
    }

    // 使用当前配置或provider的配置
    const currentConfig = config.balanceApi?.enabled ? config : provider.autoFetchConfig;
    
    if (!currentConfig?.balanceApi?.enabled) {
      return;
    }

    if (!currentConfig?.balanceApi?.endpoint) {
      toast.error('请先配置API端点');
      setShowConfigForm(true);
      return;
    }

    setLoadingBalance(true);
    try {
      // 使用当前配置创建临时provider对象
      const tempProvider = {
        ...provider,
        autoFetchConfig: currentConfig
      };
      
      const result = await apiAutoFetchService.fetchBalance(tempProvider);
      setBalanceInfo(result);
      logService.info('自动获取账户余额成功');
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      toast.error(`获取账户余额失败: ${errorMsg}`);
      logService.error('自动获取账户余额失败', error);
      // 如果获取失败，显示配置表单
      setShowConfigForm(true);
    } finally {
      setLoadingBalance(false);
    }
  };



  // 测试余额API
  const testBalanceAPI = async () => {
    if (!provider || !config.balanceApi?.enabled) {
      toast.error('请先配置并启用余额API');
      return;
    }

    setTestingBalance(true);
    
    try {
      const testProvider = { ...provider, autoFetchConfig: config };
      const result = await apiAutoFetchService.fetchBalance(testProvider);
      
      // 如果测试成功，也更新余额信息显示
      setBalanceInfo(result);
      
      toast.success('余额API测试成功！');
      logService.info('余额API测试成功');
      
    } catch (error) {
      const errorMsg = error instanceof Error ? error.message : '未知错误';
      toast.error(`余额API测试失败: ${errorMsg}`);
      logService.error('余额API测试失败', error);
    } finally {
      setTestingBalance(false);
    }
  };

  // 添加请求头
  const addHeader = () => {
    setConfig({
      ...config,
      balanceApi: {
        ...config.balanceApi,
        headers: [...(config.balanceApi?.headers || []), { key: '', value: '', valueType: 'static' as const }]
      }
    });
  };

  // 更新请求头
  const updateHeader = (index: number, field: keyof APIHeaderConfig, value: string) => {
    const newHeaders = [...(config.balanceApi?.headers || [])];
    newHeaders[index] = { ...newHeaders[index], [field]: value };
    setConfig({
      ...config,
      balanceApi: { ...config.balanceApi, headers: newHeaders }
    });
  };

  // 移除请求头
  const removeHeader = (index: number) => {
    setConfig({
      ...config,
      balanceApi: {
        ...config.balanceApi,
        headers: config.balanceApi?.headers?.filter((_, i) => i !== index) || []
      }
    });
  };

  // 添加响应字段
  const addResponseField = () => {
    setConfig({
      ...config,
      balanceApi: {
        ...config.balanceApi,
        responseFields: [...(config.balanceApi?.responseFields || []), { fieldPath: '', displayName: '' }]
      }
    });
  };

  // 更新响应字段
  const updateResponseField = (index: number, field: keyof BalanceResponseField, value: string) => {
    const newFields = [...(config.balanceApi?.responseFields || [])];
    newFields[index] = { ...newFields[index], [field]: value };
    setConfig({
      ...config,
      balanceApi: { ...config.balanceApi, responseFields: newFields }
    });
  };

  // 移除响应字段
  const removeResponseField = (index: number) => {
    setConfig({
      ...config,
      balanceApi: {
        ...config.balanceApi,
        responseFields: config.balanceApi?.responseFields?.filter((_, i) => i !== index) || []
      }
    });
  };

  // 取消配置编辑
  const handleCancel = () => {
    // 重置配置到原始状态
    if (provider) {
      setConfig(provider.autoFetchConfig || {});
    }
    
    // 返回到余额显示页面
    setShowConfigForm(false);
  };

  // 保存配置
  const handleSave = async () => {
    if (!provider) return;

    const updatedProvider: AIProvider = {
      ...provider,
      autoFetchConfig: config
    };

    onSave(updatedProvider);
    
    // 保存后返回到余额显示页面，而不是关闭弹出框
    setShowConfigForm(false);
    
    // 如果启用了余额API且配置了端点，立即获取余额信息
    if (config.balanceApi?.enabled && config.balanceApi?.endpoint) {
      setLoadingBalance(true);
      try {
        const result = await apiAutoFetchService.fetchBalance(updatedProvider);
        setBalanceInfo(result);
        logService.info('配置保存后自动获取账户余额成功');
      } catch (error) {
        const errorMsg = error instanceof Error ? error.message : '未知错误';
        toast.error(`获取账户余额失败: ${errorMsg}`);
        logService.error('配置保存后自动获取账户余额失败', error);
      } finally {
        setLoadingBalance(false);
      }
    } else {
      // 如果配置被禁用或端点被清空，清除余额信息
      setBalanceInfo(null);
    }
    
    toast.success('账户余额API配置已保存');
  };

  if (!provider) return null;

  return (
    <Dialog open={open} onOpenChange={onClose}>
      <DialogContent className="max-w-[80vw] w-full max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Wallet size={20} />
            账户余额 - {provider.name}
          </DialogTitle>
        </DialogHeader>

        <div className="space-y-6">
          {!showConfigForm ? (
            /* 余额显示界面 */
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>账户余额信息</span>
                  <div className="flex gap-2">
                    <Button 
                      onClick={fetchBalanceInfo} 
                      disabled={loadingBalance}
                      variant="outline" 
                      size="sm"
                    >
                      {loadingBalance ? (
                        <RefreshCw size={14} className="animate-spin mr-1" />
                      ) : (
                        <RefreshCw size={14} className="mr-1" />
                      )}
                      刷新
                    </Button>
                    <Button 
                      onClick={() => setShowConfigForm(true)}
                      variant="outline" 
                      size="sm"
                    >
                      <TestTube size={14} className="mr-1" />
                      配置API
                    </Button>
                  </div>
                </CardTitle>
              </CardHeader>
              <CardContent>
                {loadingBalance ? (
                  <div className="flex items-center justify-center py-8">
                    <RefreshCw size={24} className="animate-spin mr-2" />
                    <span>正在获取账户余额...</span>
                  </div>
                ) : balanceInfo ? (
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    {provider?.autoFetchConfig?.balanceApi?.responseFields?.map((field, index) => {
                      const value = balanceInfo[field.fieldPath];
                      const displayValue = typeof value === 'boolean' 
                        ? (value ? '可用' : '不可用')
                        : String(value || 'N/A');
                      const textColor = typeof value === 'boolean'
                        ? (value ? 'text-green-600' : 'text-red-600')
                        : 'text-green-600';
                      
                      return (
                        <div key={index} className="bg-gray-50 p-4 rounded-lg">
                          <div className="text-sm font-medium text-gray-500 mb-2">{field.displayName}</div>
                          <div className={`text-lg font-medium ${textColor}`}>
                            {displayValue}
                          </div>
                        </div>
                      );
                    }) || (
                      <div className="col-span-full text-center py-8 text-gray-500">
                        <p>暂无字段配置</p>
                        <p className="text-sm">请在配置页面添加响应字段</p>
                      </div>
                    )}
                  </div>
                ) : (
                  <div className="text-center py-8 text-gray-500">
                    <Wallet size={48} className="mx-auto mb-4 text-gray-300" />
                    <p>暂无余额信息</p>
                    <p className="text-sm">请检查API配置或点击刷新</p>
                  </div>
                )}
              </CardContent>
            </Card>
          ) : (
            /* 配置API界面 */
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center justify-between">
                  <span>账户余额API配置</span>
                  <Button 
                    onClick={testBalanceAPI} 
                    disabled={testingBalance || !config.balanceApi?.enabled}
                    variant="outline" 
                    size="sm"
                  >
                    {testingBalance ? (
                      <RefreshCw size={14} className="animate-spin mr-1" />
                    ) : (
                      <TestTube size={14} className="mr-1" />
                    )}
                    测试API
                  </Button>
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="flex items-center space-x-2">
                  <Checkbox 
                    id="balance-enabled"
                    checked={config.balanceApi?.enabled || false}
                    onCheckedChange={(checked) => setConfig({
                      ...config,
                      balanceApi: { ...config.balanceApi, enabled: checked === true }
                    })}
                  />
                  <Label htmlFor="balance-enabled">启用账户余额API自动获取</Label>
                </div>

                {config.balanceApi?.enabled && (
                  <>
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
                      <div>
                        <Label>API端点</Label>
                        <Input
                          value={config.balanceApi?.endpoint || ''}
                          onChange={(e) => setConfig({
                            ...config,
                            balanceApi: { ...config.balanceApi, endpoint: e.target.value }
                          })}
                          placeholder="https://api.deepseek.com/user/balance"
                          className="w-full"
                        />
                      </div>
                      <div>
                        <Label>请求方法</Label>
                        <Select
                          value={config.balanceApi?.method || 'GET'}
                          onValueChange={(value: 'GET' | 'POST') => setConfig({
                            ...config,
                            balanceApi: { ...config.balanceApi, method: value }
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

                    <div>
                      <Label>响应路径 - API返回数据的根路径</Label>
                      <Input
                        value={config.balanceApi?.responsePath || ''}
                        onChange={(e) => setConfig({
                          ...config,
                          balanceApi: { ...config.balanceApi, responsePath: e.target.value }
                        })}
                        placeholder="留空表示根级别"
                        className="w-full"
                      />
                    </div>

                    {/* 响应字段配置 */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label>响应字段配置</Label>
                        <Button 
                          onClick={addResponseField} 
                          variant="outline" 
                          size="sm"
                        >
                          <Plus size={14} className="mr-1" />
                          添加字段
                        </Button>
                      </div>
                      {config.balanceApi?.responseFields?.map((field, index) => (
                        <div key={index} className="flex gap-2 mb-2">
                          <Input
                            placeholder="字段路径 (如: is_available)"
                            value={field.fieldPath}
                            onChange={(e) => updateResponseField(index, 'fieldPath', e.target.value)}
                            className="flex-1"
                          />
                          <Input
                            placeholder="显示名称 (如: 账户可用状态)"
                            value={field.displayName}
                            onChange={(e) => updateResponseField(index, 'displayName', e.target.value)}
                            className="flex-1"
                          />
                          <Button 
                            onClick={() => removeResponseField(index)} 
                            variant="outline" 
                            size="sm"
                          >
                            <Trash2 size={14} />
                          </Button>
                        </div>
                      ))}
                      {(!config.balanceApi?.responseFields || config.balanceApi.responseFields.length === 0) && (
                        <div className="text-sm text-gray-500 p-4 border border-dashed rounded">
                          暂无响应字段配置，点击&ldquo;添加字段&rdquo;开始配置
                        </div>
                      )}
                    </div>

                    {/* 请求头配置 */}
                    <div>
                      <div className="flex items-center justify-between mb-2">
                        <Label>请求头</Label>
                        <Button 
                          onClick={addHeader} 
                          variant="outline" 
                          size="sm"
                        >
                          <Plus size={14} className="mr-1" />
                          添加
                        </Button>
                      </div>
                      {config.balanceApi?.headers?.map((header, index) => (
                        <div key={index} className="flex gap-2 mb-2">
                          <Input
                            placeholder="键名 (如: Authorization)"
                            value={header.key}
                            onChange={(e) => updateHeader(index, 'key', e.target.value)}
                            className="flex-1"
                          />
                          <Input
                            placeholder="值 (如: Bearer token)"
                            value={header.value}
                            onChange={(e) => updateHeader(index, 'value', e.target.value)}
                            className="flex-1"
                          />
                          <Input
                            placeholder="模板 (如: Bearer {apiKey})"
                            value={header.valueTemplate || ''}
                            onChange={(e) => updateHeader(index, 'valueTemplate', e.target.value)}
                            className="flex-1"
                          />
                          <Button 
                            onClick={() => removeHeader(index)} 
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
          )}
        </div>

        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={showConfigForm ? handleCancel : onClose}
          >
            {showConfigForm ? '取消' : '关闭'}
          </Button>
          {showConfigForm && (
            <Button onClick={handleSave}>
              保存配置
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};

export default BalanceAPIConfig; 