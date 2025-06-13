import React, { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { FileText, Folder, Play, Loader2 } from 'lucide-react';
import { mcpService } from '../services/mcp';
import { logService } from '../services/log';

interface FilesystemDemoProps {
  onClose?: () => void;
}

const FilesystemDemo: React.FC<FilesystemDemoProps> = ({ onClose }) => {
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<string>('');
  const [path, setPath] = useState('./');
  const [content, setContent] = useState('');
  const [pattern, setPattern] = useState('*.txt');

  useEffect(() => {
    // 初始化MCP服务
    const initMCP = async () => {
      try {
        await mcpService.initializeServers();
        logService.info('MCP服务初始化完成');
      } catch (error) {
        logService.error('MCP服务初始化失败', error);
      }
    };
    
    initMCP();
  }, []);

  const executeCommand = async (toolName: string, args: Record<string, unknown>) => {
    setLoading(true);
    setResult('');
    
    try {
      const response = await mcpService.callTool('builtin-filesystem', toolName, args);
      
      if (response.success) {
        setResult(response.content || '操作成功');
      } else {
        setResult(`错误: ${response.error}`);
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : '未知错误';
      setResult(`执行失败: ${errorMessage}`);
      logService.error(`文件系统操作失败: ${toolName}`, error);
    } finally {
      setLoading(false);
    }
  };

  const handleListDirectory = () => {
    executeCommand('list_directory', { path });
  };

  const handleReadFile = () => {
    executeCommand('read_file', { path });
  };

  const handleWriteFile = () => {
    if (!content.trim()) {
      setResult('错误: 请输入文件内容');
      return;
    }
    executeCommand('write_file', { path, content });
  };

  const handleCreateDirectory = () => {
    executeCommand('create_directory', { path });
  };

  const handleGetInfo = () => {
    executeCommand('get_item_info', { path });
  };

  const handleSearchFiles = () => {
    executeCommand('search_files', { 
      path: path || './', 
      pattern: pattern || '.*',
      recursive: true,
      case_sensitive: false,
      file_only: true
    });
  };

  return (
    <div className="space-y-6">
      {/* 头部 */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-semibold">文件系统服务演示</h2>
          <p className="text-gray-600 mt-1">测试内置文件系统MCP服务的各种功能</p>
        </div>
        {onClose && (
          <Button variant="outline" onClick={onClose}>
            关闭
          </Button>
        )}
      </div>

      {/* 输入区域 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <FileText className="w-5 h-5" />
            操作参数
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-4">
          <div>
            <label className="block text-sm font-medium mb-2">文件/目录路径</label>
            <Input
              value={path}
              onChange={(e) => setPath(e.target.value)}
              placeholder="例如: ./test.txt 或 ./my-folder"
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">文件内容（写入文件时使用）</label>
            <Textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="输入要写入的文件内容..."
              rows={4}
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium mb-2">搜索模式（搜索文件时使用）</label>
            <Input
              value={pattern}
              onChange={(e) => setPattern(e.target.value)}
              placeholder="例如: *.txt 或 test.*"
            />
          </div>
        </CardContent>
      </Card>

      {/* 操作按钮 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Play className="w-5 h-5" />
            文件系统操作
          </CardTitle>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            <Button
              onClick={handleListDirectory}
              disabled={loading}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Folder className="w-4 h-4" />
              列出目录
            </Button>
            
            <Button
              onClick={handleReadFile}
              disabled={loading}
              variant="outline"
              className="flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              读取文件
            </Button>
            
            <Button
              onClick={handleWriteFile}
              disabled={loading}
              variant="outline"
              className="flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              写入文件
            </Button>
            
            <Button
              onClick={handleCreateDirectory}
              disabled={loading}
              variant="outline"
              className="flex items-center gap-2"
            >
              <Folder className="w-4 h-4" />
              创建目录
            </Button>
            
            <Button
              onClick={handleGetInfo}
              disabled={loading}
              variant="outline"
              className="flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              获取信息
            </Button>
            
            <Button
              onClick={handleSearchFiles}
              disabled={loading}
              variant="outline"
              className="flex items-center gap-2"
            >
              <FileText className="w-4 h-4" />
              搜索文件
            </Button>
          </div>
        </CardContent>
      </Card>

      {/* 结果显示 */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            {loading && <Loader2 className="w-5 h-5 animate-spin" />}
            执行结果
          </CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin mr-2" />
              <span>正在执行操作...</span>
            </div>
          ) : (
            <div className="bg-gray-50 p-4 rounded-lg">
              <pre className="whitespace-pre-wrap text-sm">
                {result || '请选择一个操作来查看结果'}
              </pre>
            </div>
          )}
        </CardContent>
      </Card>

      {/* 使用说明 */}
      <Card>
        <CardHeader>
          <CardTitle>使用说明</CardTitle>
        </CardHeader>
        <CardContent>
          <div className="space-y-3 text-sm">
            <div className="bg-blue-50 p-3 rounded-lg">
              <h4 className="font-medium text-blue-800 mb-2">💡 操作说明：</h4>
              <div className="text-blue-700 space-y-1">
                <p>• <strong>列出目录</strong>：显示指定目录下的所有文件和子目录</p>
                <p>• <strong>读取文件</strong>：读取并显示文件内容</p>
                <p>• <strong>写入文件</strong>：将内容写入到指定文件</p>
                <p>• <strong>创建目录</strong>：创建新的目录</p>
                <p>• <strong>获取信息</strong>：显示文件或目录的详细信息</p>
                <p>• <strong>搜索文件</strong>：在指定目录中搜索匹配的文件</p>
              </div>
            </div>
            
            <div className="bg-amber-50 p-3 rounded-lg">
              <h4 className="font-medium text-amber-800 mb-2">⚠️ 安全提示：</h4>
              <div className="text-amber-700 space-y-1">
                <p>• 文件系统服务只能访问允许的路径范围内的文件</p>
                <p>• 支持的文件类型有限，主要是文本文件和代码文件</p>
                <p>• 单个文件大小限制为10MB</p>
                <p>• 所有操作都会记录日志以便审计</p>
              </div>
            </div>
          </div>
        </CardContent>
      </Card>
    </div>
  );
};

export default FilesystemDemo; 