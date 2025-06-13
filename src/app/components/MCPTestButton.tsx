"use client";

import { FC, useState } from 'react';
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Loader2, Play, CheckCircle, XCircle } from 'lucide-react';
import { aiService } from '../services/ai';
import { logService } from '../services/log';

/**
 * MCP工具调用测试按钮组件
 * 用于测试工具调用时的用户界面提示功能
 */
const MCPTestButton: FC = () => {
  const [isLoading, setIsLoading] = useState(false);
  const [response, setResponse] = useState<string>('');
  const [error, setError] = useState<string>('');

  const handleTestToolCall = async () => {
    setIsLoading(true);
    setResponse('');
    setError('');
    
    try {
      logService.info('开始测试MCP工具调用');
      
      // 测试消息，应该触发文件系统工具调用
      const testMessage = "请帮我列出当前目录下的所有文件";
      
      // 使用流式调用来观察工具调用提示
      await aiService.sendMessageStream(
        testMessage,
        (content: string, done: boolean, error?: boolean, reasoningContent?: string) => {
          if (error) {
            setError(content);
          } else {
            setResponse(content);
            if (reasoningContent) {
              logService.info(`推理内容: ${reasoningContent}`);
            }
          }
          
          if (done) {
            setIsLoading(false);
            logService.info('MCP工具调用测试完成');
          }
        }
      );
    } catch (err) {
      logService.error('MCP工具调用测试失败', err);
      setError(err instanceof Error ? err.message : '未知错误');
      setIsLoading(false);
    }
  };

  return (
    <Card className="w-full max-w-2xl">
      <CardHeader>
        <CardTitle className="flex items-center gap-2">
          <Play className="h-5 w-5" />
          MCP工具调用测试
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="text-sm text-muted-foreground">
          点击下方按钮测试AI工具调用时的用户界面提示功能。
          <br />
          测试将发送一个文件系统操作请求，观察工具调用过程中的提示信息。
        </div>
        
        <Button 
          onClick={handleTestToolCall}
          disabled={isLoading}
          className="w-full"
        >
          {isLoading ? (
            <>
              <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              测试进行中...
            </>
          ) : (
            <>
              <Play className="mr-2 h-4 w-4" />
              开始测试工具调用
            </>
          )}
        </Button>
        
        {/* 响应显示区域 */}
        {(response || error) && (
          <div className="space-y-2">
            <div className="text-sm font-medium">测试结果:</div>
            <div className={`p-3 rounded-md text-sm ${
              error 
                ? 'bg-red-50 border border-red-200 text-red-800' 
                : 'bg-green-50 border border-green-200 text-green-800'
            }`}>
              {error ? (
                <div className="flex items-start gap-2">
                  <XCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium">测试失败</div>
                    <div className="mt-1">{error}</div>
                  </div>
                </div>
              ) : (
                <div className="flex items-start gap-2">
                  <CheckCircle className="h-4 w-4 mt-0.5 flex-shrink-0" />
                  <div>
                    <div className="font-medium">测试成功</div>
                    <div className="mt-1 whitespace-pre-wrap">{response}</div>
                  </div>
                </div>
              )}
            </div>
          </div>
        )}
        
        {/* 说明文字 */}
        <div className="text-xs text-muted-foreground border-t pt-3">
          <div className="font-medium mb-1">预期行为:</div>
          <ul className="space-y-1 list-disc list-inside">
            <li>首先显示: &ldquo;🔧 AI正在调用工具处理您的请求，请稍候...&rdquo;</li>
            <li>然后显示: &ldquo;🔧 AI正在使用工具 &lsquo;list_directory&rsquo; 处理您的请求，请稍候...&rdquo;</li>
            <li>接着显示: &ldquo;⚙️ 正在执行工具：list_directory...&rdquo;</li>
            <li>最后显示: &ldquo;✅ 工具执行完成，正在生成回复...&rdquo;</li>
            <li>最终显示AI基于工具结果生成的回复</li>
          </ul>
        </div>
      </CardContent>
    </Card>
  );
};

export default MCPTestButton; 