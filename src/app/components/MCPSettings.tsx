import React, { useState, useEffect } from 'react';
import { Plus, Settings, Trash2, CheckCircle, XCircle, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { Checkbox } from '@/components/ui/checkbox';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger } from '@/components/ui/dialog';
import { MCPServerConfig, MCPServerStatus } from '../types';
import { mcpService } from '../services/mcp';
import { logService } from '../services/log';
import MCPTestButton from './MCPTestButton';

interface MCPSettingsProps {
  onClose?: () => void;
}

const MCPSettings: React.FC<MCPSettingsProps> = ({ onClose }) => {
  const [configs, setConfigs] = useState<MCPServerConfig[]>([]);
  const [statuses, setStatuses] = useState<MCPServerStatus[]>([]);
  const [loading, setLoading] = useState(true);
  const [updating, setUpdating] = useState<string | null>(null);
  const [isAddDialogOpen, setIsAddDialogOpen] = useState(false);
  const [newServer, setNewServer] = useState<Partial<MCPServerConfig>>({
    name: '',
    description: '',
    command: '',
    args: [],
    enabled: true,
    type: 'external'
  });

  useEffect(() => {
    loadMCPData();
  }, []);

  const loadMCPData = async () => {
    try {
      setLoading(true);
      
      // 检查localStorage中的MCP配置
      const storedConfigs = localStorage.getItem('mcpServerConfigs');
      logService.info(`设置页面 - localStorage中的MCP配置: ${storedConfigs}`);
      
      // 强制重新加载配置
      mcpService.reloadServerConfigs();
      
      // 强制重新初始化MCP服务
      await mcpService.initializeServers();
      
      // 获取配置和状态
      const serverConfigs = mcpService.getServerConfigs();
      const serverStatuses = mcpService.getServerStatuses();
      
      logService.info(`设置页面 - 获取到 ${serverConfigs.length} 个服务器配置`);
      logService.info(`设置页面 - 获取到 ${serverStatuses.length} 个服务器状态`);
      
      setConfigs(serverConfigs);
      setStatuses(serverStatuses);
    } catch (error) {
      logService.error('加载MCP数据失败', error);
    } finally {
      setLoading(false);
    }
  };

  const handleToggleServer = async (serverId: string, enabled: boolean) => {
    setUpdating(serverId);
    
    try {
      const config = configs.find(c => c.id === serverId);
      if (!config) return;

      const updatedConfig = { ...config, enabled };
      await mcpService.updateServerConfig(updatedConfig);
      
      // 重新加载数据
      await loadMCPData();
    } catch (error) {
      logService.error(`切换服务器状态失败: ${serverId}`, error);
    } finally {
      setUpdating(null);
    }
  };

  const handleAddServer = async () => {
    if (!newServer.name || !newServer.command) {
      return;
    }

    try {
      const config: MCPServerConfig = {
        id: Date.now().toString(),
        name: newServer.name,
        description: newServer.description || '',
        command: newServer.command,
        args: newServer.args || [],
        enabled: newServer.enabled ?? true,
        type: 'external',
        capabilities: {
          tools: true,
          resources: true,
          prompts: true
        },
        permissions: {
          allowToolExecution: true,
          allowResourceAccess: true
        }
      };

      await mcpService.updateServerConfig(config);
      await loadMCPData();
      
      // 重置表单
      setNewServer({
        name: '',
        description: '',
        command: '',
        args: [],
        enabled: true,
        type: 'external'
      });
      setIsAddDialogOpen(false);
    } catch (error) {
      logService.error('添加服务器失败', error);
    }
  };

  const handleDeleteServer = async (serverId: string) => {
    if (!confirm('确定要删除这个MCP服务器吗？')) {
      return;
    }

    try {
      await mcpService.deleteServerConfig(serverId);
      await loadMCPData();
    } catch (error) {
      logService.error('删除服务器失败', error);
    }
  };

  const getServerStatus = (serverId: string) => {
    return statuses.find(s => s.id === serverId);
  };

  const getToolsCount = (serverId: string) => {
    const status = getServerStatus(serverId);
    return status?.capabilities?.tools?.length || 0;
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader2 className="w-6 h-6 animate-spin mr-2" />
        <span>加载MCP配置...</span>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">MCP 设置</h2>
          <p className="text-gray-600 mt-1">管理模型上下文协议(MCP)服务器</p>
        </div>
        <div className="flex space-x-2">
          {/* 添加服务器按钮 */}
          <Dialog open={isAddDialogOpen} onOpenChange={setIsAddDialogOpen}>
            <DialogTrigger asChild>
              <Button>
                <Plus className="h-4 w-4 mr-2" />
                添加服务器
              </Button>
            </DialogTrigger>
            <DialogContent className="max-w-md">
              <DialogHeader>
                <DialogTitle>添加MCP服务器</DialogTitle>
              </DialogHeader>
              <div className="space-y-4">
                <div>
                  <Label htmlFor="server-name">服务器名称</Label>
                  <Input
                    id="server-name"
                    value={newServer.name || ''}
                    onChange={(e) => setNewServer(prev => ({ ...prev, name: e.target.value }))}
                    placeholder="输入服务器名称"
                  />
                </div>
                
                <div>
                  <Label htmlFor="server-description">描述（可选）</Label>
                  <Textarea
                    id="server-description"
                    value={newServer.description || ''}
                    onChange={(e) => setNewServer(prev => ({ ...prev, description: e.target.value }))}
                    placeholder="输入服务器描述"
                    rows={2}
                  />
                </div>
                
                <div>
                  <Label htmlFor="server-command">启动命令</Label>
                  <Input
                    id="server-command"
                    value={newServer.command || ''}
                    onChange={(e) => setNewServer(prev => ({ ...prev, command: e.target.value }))}
                    placeholder="例如: npx @modelcontextprotocol/server-filesystem"
                  />
                </div>
                
                <div>
                  <Label htmlFor="server-args">命令参数（可选）</Label>
                  <Input
                    id="server-args"
                    value={newServer.args?.join(' ') || ''}
                    onChange={(e) => setNewServer(prev => ({ 
                      ...prev, 
                      args: e.target.value.split(' ').filter(arg => arg.trim() !== '')
                    }))}
                    placeholder="例如: --path /Users/username"
                  />
                </div>
                
                <div className="flex items-center space-x-2">
                  <Checkbox
                    id="server-enabled"
                    checked={newServer.enabled ?? true}
                    onCheckedChange={(checked: boolean) => setNewServer(prev => ({ ...prev, enabled: checked }))}
                  />
                  <Label htmlFor="server-enabled">启用服务器</Label>
                </div>
                
                <div className="flex justify-end space-x-2">
                  <Button variant="outline" onClick={() => setIsAddDialogOpen(false)}>
                    取消
                  </Button>
                  <Button onClick={handleAddServer}>
                    添加
                  </Button>
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          {onClose && (
            <Button variant="outline" onClick={onClose}>
              关闭
            </Button>
          )}
        </div>
      </div>

      {/* 服务器状态概览 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Settings className="w-5 h-5" />
            服务器状态
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="text-center p-4 bg-blue-50 rounded-lg">
              <div className="text-2xl font-bold text-blue-600">{configs.length}</div>
              <div className="text-sm text-gray-600">总服务器数</div>
            </div>
            <div className="text-center p-4 bg-green-50 rounded-lg">
              <div className="text-2xl font-bold text-green-600">
                {statuses.filter(s => s.connected).length}
              </div>
              <div className="text-sm text-gray-600">已连接</div>
            </div>
            <div className="text-center p-4 bg-orange-50 rounded-lg">
              <div className="text-2xl font-bold text-orange-600">
                {statuses.reduce((total, s) => total + (s.capabilities?.tools?.length || 0), 0)}
              </div>
              <div className="text-sm text-gray-600">可用工具</div>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* 服务器列表 */}
      <Card>
        <CardHeader>
          <CardTitle>MCP 服务器</CardTitle>
        </CardHeader>
        <CardContent>
          {configs.length === 0 ? (
            <div className="text-center py-8">
              <Settings className="w-12 h-12 mx-auto text-gray-400 mb-4" />
              <h3 className="text-lg font-medium text-gray-900 mb-2">没有配置MCP服务器</h3>
              <p className="text-gray-600 mb-4">
                添加一个MCP服务器来扩展AI的能力
              </p>
              <Button onClick={() => setIsAddDialogOpen(true)}>
                <Plus className="h-4 w-4 mr-2" />
                添加第一个服务器
              </Button>
            </div>
          ) : (
            <div className="space-y-4">
              {configs.map((config) => {
                const status = getServerStatus(config.id);
                const toolsCount = getToolsCount(config.id);
                const isUpdating = updating === config.id;

                return (
                  <div
                    key={config.id}
                    className={`p-4 border rounded-lg transition-colors ${
                      status?.connected 
                        ? 'border-green-200 bg-green-50' 
                        : 'border-gray-200 bg-gray-50'
                    }`}
                  >
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-3">
                        <Settings className="w-5 h-5" />
                        <div>
                          <h3 className="font-medium">{config.name}</h3>
                          <p className="text-sm text-gray-600">{config.description}</p>
                          <p className="text-xs text-gray-500 mt-1">
                            命令: {config.command} {config.args?.join(' ')}
                          </p>
                        </div>
                      </div>

                      <div className="flex items-center space-x-4">
                        {/* 工具数量 */}
                        {toolsCount > 0 && (
                          <span className="px-2 py-1 bg-blue-100 text-blue-800 text-xs rounded-full">
                            {toolsCount} 工具
                          </span>
                        )}

                        {/* 连接状态 */}
                        <div className="flex items-center space-x-1">
                          {status?.connected ? (
                            <CheckCircle className="w-4 h-4 text-green-500" />
                          ) : (
                            <XCircle className="w-4 h-4 text-red-500" />
                          )}
                          <span className="text-sm">
                            {status?.connected ? '已连接' : '未连接'}
                          </span>
                        </div>

                        {/* 删除按钮 */}
                        <Button
                          variant="outline"
                          size="sm"
                          onClick={() => handleDeleteServer(config.id)}
                          className="text-red-600 hover:text-red-700 hover:bg-red-50"
                        >
                          <Trash2 className="w-4 h-4" />
                        </Button>

                        {/* 启用开关 */}
                        <div className="flex items-center space-x-2">
                          {isUpdating && <Loader2 className="w-4 h-4 animate-spin" />}
                          <button
                            onClick={() => handleToggleServer(config.id, !config.enabled)}
                            disabled={isUpdating}
                            className={`relative inline-flex h-6 w-11 items-center rounded-full transition-colors focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 ${
                              config.enabled ? 'bg-blue-600' : 'bg-gray-200'
                            }`}
                          >
                            <span
                              className={`inline-block h-4 w-4 transform rounded-full bg-white transition-transform ${
                                config.enabled ? 'translate-x-6' : 'translate-x-1'
                              }`}
                            />
                          </button>
                        </div>
                      </div>
                    </div>

                    {/* 错误信息 */}
                    {status?.lastError && (
                      <div className="mt-2 p-2 bg-red-100 border border-red-200 rounded text-sm text-red-700">
                        错误: {status.lastError}
                      </div>
                    )}

                    {/* 工具列表 */}
                    {status?.capabilities?.tools && status.capabilities.tools.length > 0 && (
                      <div className="mt-3">
                        <h4 className="text-sm font-medium mb-2">可用工具:</h4>
                        <div className="flex flex-wrap gap-2">
                          {status.capabilities.tools.map((tool) => (
                            <span
                              key={tool.name}
                              className="px-2 py-1 bg-gray-100 border border-gray-300 text-gray-700 text-xs rounded"
                              title={tool.description}
                            >
                              {tool.name}
                            </span>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          )}
        </CardContent>
      </Card>

      {/* MCP工具测试 */}
      <MCPTestButton />

      {/* 使用说明 */}
      <Card>
        <CardHeader>
          <CardTitle>关于 MCP</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-4 text-sm">
            <p>
              模型上下文协议(MCP)是一个开放标准，让AI模型能够安全地访问外部工具和数据源。
            </p>
            
            <div className="bg-blue-50 p-3 rounded-lg">
              <h4 className="font-medium text-blue-800 mb-2">💡 如何使用：</h4>
              <div className="text-blue-700 space-y-1">
                <p>1. 添加并启用MCP服务器</p>
                <p>2. 确保服务器状态显示为&quot;已连接&quot;</p>
                <p>3. 在聊天中直接描述您的需求，AI会自动选择合适的工具</p>
                <p>4. 无需特殊语法，用自然语言即可触发工具调用</p>
              </div>
            </div>
            
            <div className="bg-green-50 p-3 rounded-lg">
              <h4 className="font-medium text-green-800 mb-2">📦 可用的MCP服务器：</h4>
              <div className="text-green-700 space-y-1">
                <p>• <strong>文件系统服务</strong> - 内置服务，提供文件读写、目录管理等功能</p>
                <p>• <code>npx @modelcontextprotocol/server-brave-search</code> - 网页搜索</p>
                <p>• <code>npx @modelcontextprotocol/server-github</code> - GitHub集成</p>
                <p>• <code>npx @modelcontextprotocol/server-sqlite</code> - SQLite数据库操作</p>
              </div>
            </div>
            
            <div className="bg-amber-50 p-3 rounded-lg">
              <h4 className="font-medium text-amber-800 mb-2">⚠️ 注意事项：</h4>
              <div className="text-amber-700 space-y-1">
                <p>• 确保已安装相应的MCP服务器包</p>
                <p>• 某些服务器可能需要额外的配置参数</p>
                <p>• AI会根据上下文智能判断是否需要使用工具</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default MCPSettings; 