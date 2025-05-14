"use client";

import { FC, useState, useRef, useEffect } from 'react';
import { Send, Loader2, Square } from 'lucide-react';
import { Message, AIProvider, AIModel } from '../types';
import { aiService } from '../services/ai';
import { storageService } from '../services/storage';
import { logService } from '../services/log';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Markdown } from "@/components/ui/markdown";

/**
 * 聊天界面组件
 * 包含消息列表和发送消息功能
 */
const ChatInterface: FC = () => {
  // 聊天消息状态
  const [messages, setMessages] = useState<Message[]>([]);
  // 输入框内容状态
  const [input, setInput] = useState('');
  // 加载状态
  const [isLoading, setIsLoading] = useState(false);
  // 当前选中的AI提供商
  const [selectedProvider, setSelectedProvider] = useState<string>('default');
  // 当前选中的AI模型
  const [selectedModel, setSelectedModel] = useState<string>('');
  // 可用的AI提供商列表
  const [aiProviders, setAiProviders] = useState<AIProvider[]>([]);
  // 当前提供商的可用模型
  const [availableModels, setAvailableModels] = useState<AIModel[]>([]);
  
  // 聊天容器引用，用于自动滚动
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 加载本地存储的数据，确保在客户端执行
  useEffect(() => {
    // 加载聊天历史
    try {
      const savedMessages = localStorage.getItem('chatHistory');
      if (savedMessages) {
        const parsedMessages = JSON.parse(savedMessages);
        // 确保timestamp是Date对象
        setMessages(parsedMessages.map((msg: Omit<Message, 'timestamp'> & { timestamp: string }) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        })));
        logService.info(`已加载 ${parsedMessages.length} 条聊天历史记录`);
      } else {
        logService.info('没有找到聊天历史记录');
      }
    } catch (error) {
      console.error('加载聊天历史失败:', error);
      logService.error('加载聊天历史失败', error);
    }
    
    // 加载AI提供商列表
    const providers = aiService.getAvailableProviders();
    if (providers.length > 0) {
      setAiProviders(providers);
      
      // 加载选择的提供商ID
      try {
        const savedProviderId = storageService.getSelectedProviderId();
        if (savedProviderId && providers.some(p => p.id === savedProviderId)) {
          setSelectedProvider(savedProviderId);
          logService.info(`已加载选中的提供商ID: ${savedProviderId}`);
          
          // 获取该提供商的模型列表
          const selectedProviderData = providers.find(p => p.id === savedProviderId);
          if (selectedProviderData) {
            setAvailableModels(selectedProviderData.models || []);
            
            // 设置默认选中的模型
            if (selectedProviderData.defaultModelId) {
              setSelectedModel(selectedProviderData.defaultModelId);
            } else if (selectedProviderData.models && selectedProviderData.models.length > 0) {
              setSelectedModel(selectedProviderData.models[0].id);
            }
          }
        } else if (providers.length > 0) {
          // 如果没有保存的提供商ID或提供商不存在，使用第一个提供商
          setSelectedProvider(providers[0].id);
          
          // 获取第一个提供商的模型列表
          setAvailableModels(providers[0].models || []);
          
          // 设置默认选中的模型
          if (providers[0].defaultModelId) {
            setSelectedModel(providers[0].defaultModelId);
          } else if (providers[0].models && providers[0].models.length > 0) {
            setSelectedModel(providers[0].models[0].id);
          }
        }
      } catch (error) {
        console.error('加载选中提供商ID失败:', error);
        logService.error('加载选中提供商ID失败', error);
      }
      
      logService.info(`已加载 ${providers.length} 个AI提供商`);
    } else {
      // 默认提供商
      const defaultProvider = {
        id: 'default',
        name: 'ChatGPT',
        apiEndpoint: 'https://api.openai.com/v1/chat/completions',
        apiKey: '',
        models: [
          { id: 'gpt-3.5-turbo', name: 'GPT-3.5 Turbo' }
        ],
        defaultModelId: 'gpt-3.5-turbo'
      };
      setAiProviders([defaultProvider]);
      setSelectedProvider(defaultProvider.id);
      setAvailableModels(defaultProvider.models);
      setSelectedModel(defaultProvider.defaultModelId || defaultProvider.models[0].id);
      logService.info('使用默认AI提供商');
    }
  }, []);
  
  // 监听提供商变化，更新模型列表
  useEffect(() => {
    const providerData = aiProviders.find(p => p.id === selectedProvider);
    if (providerData) {
      const models = providerData.models || [];
      setAvailableModels(models);
      
      // 如果之前选中的模型不在新提供商的模型列表中，则选择默认模型
      if (!models.some(m => m.id === selectedModel)) {
        if (providerData.defaultModelId) {
          setSelectedModel(providerData.defaultModelId);
        } else if (models.length > 0) {
          setSelectedModel(models[0].id);
        } else {
          setSelectedModel('');
        }
      }
      
      // 保存选中的提供商ID
      storageService.saveSelectedProviderId(selectedProvider);
      logService.debug(`保存选中的提供商ID: ${selectedProvider}`);
    }
  }, [selectedProvider, aiProviders]);
  
  // 保存聊天历史到本地存储
  useEffect(() => {
    if (messages.length > 0) {
      try {
        localStorage.setItem('chatHistory', JSON.stringify(messages));
        logService.debug(`已保存 ${messages.length} 条聊天历史记录`);
      } catch (error) {
        console.error('保存聊天历史失败:', error);
        logService.error('保存聊天历史失败', error);
      }
    }
  }, [messages]);
  
  // 处理停止生成
  const handleStopGeneration = () => {
    logService.info('用户请求停止生成');
    aiService.cancelStream();
  };

  // 流式消息更新处理函数
  const handleStreamUpdate = (assistantMessageId: string, content: string, done: boolean, error?: boolean) => {
    setMessages(prevMessages => {
      return prevMessages.map(msg => {
        if (msg.id === assistantMessageId) {
          return {
            ...msg,
            content: content,
            streaming: !done,
            // 如果是错误且完成，则标记为取消状态
            canceled: done && error ? true : undefined
          };
        }
        return msg;
      });
    });
    
    if (done) {
      setIsLoading(false);
      if (error) {
        logService.warn(`流式消息中断: ${content}`);
      } else {
        logService.info(`流式消息完成: ${content.substring(0, 50)}${content.length > 50 ? '...' : ''}`);
      }
    }
  };
  
  // 消息发送处理函数
  const handleSendMessage = async () => {
    if (!input.trim() || isLoading || !selectedModel) return;
    
    logService.info(`发送用户消息: ${input.substring(0, 50)}${input.length > 50 ? '...' : ''}`);
    
    // 创建用户消息
    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      role: 'user',
      timestamp: new Date()
    };
    
    // 创建一个空的助手消息，用于流式更新
    const assistantMessageId = (Date.now() + 1).toString();
    const assistantMessage: Message = {
      id: assistantMessageId,
      content: '',
      role: 'assistant',
      timestamp: new Date(),
      streaming: true // 标记为流式消息
    };
    
    // 更新消息列表，添加用户消息和初始空的助手消息
    setMessages(prev => [...prev, userMessage, assistantMessage]);
    setInput('');
    setIsLoading(true);
    
    try {
      // 传递完整的聊天历史以保持上下文（不包括刚创建的空助手消息）
      const history = [...messages, userMessage].map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
      logService.debug(`使用提供商 ${selectedProvider} 的模型 ${selectedModel} 流式发送消息`);
      
      // 调用AI服务发送流式消息
      await aiService.sendMessageStream(
        input, 
        (content, done, error) => handleStreamUpdate(assistantMessageId, content, done, error),
        selectedProvider, 
        history, 
        selectedModel
      );
    } catch (error) {
      console.error('发送消息失败:', error);
      logService.error('发送消息失败', error);
      
      // 更新助手消息为错误消息
      setMessages(prev => 
        prev.map(msg => 
          msg.id === assistantMessageId 
            ? {
                ...msg,
                content: '发送消息失败，请检查网络或API设置。',
                streaming: false
              }
            : msg
        )
      );
      setIsLoading(false);
    }
  };
  
  // 自动滚动到最新消息
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);
  
  // 格式化时间
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit'
    });
  };

  // 清除聊天记录
  const handleClearChat = () => {
    setMessages([]);
    localStorage.removeItem('chatHistory');
    logService.info('已清空聊天记录');
  };

  return (
    <div className="flex flex-col h-full">
      {/* 头部 */}
      <div className="border-b border-gray-200 dark:border-gray-800 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">聊天</h1>
          <div className="flex items-center gap-2">
            <div className="flex gap-2">
              {/* 提供商选择 */}
              <Select value={selectedProvider} onValueChange={setSelectedProvider}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="选择AI提供商" />
                </SelectTrigger>
                <SelectContent>
                  {aiProviders.map(provider => (
                    <SelectItem key={provider.id} value={provider.id}>
                      {provider.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              
              {/* 模型选择 */}
              <Select value={selectedModel} onValueChange={setSelectedModel}>
                <SelectTrigger className="w-[180px]">
                  <SelectValue placeholder="选择模型" />
                </SelectTrigger>
                <SelectContent>
                  {availableModels.map(model => (
                    <SelectItem key={model.id} value={model.id}>
                      {model.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            
            {messages.length > 0 && (
              <Button
                variant="outline"
                size="sm"
                onClick={handleClearChat}
                className="cursor-pointer"
              >
                清空对话
              </Button>
            )}
          </div>
        </div>
      </div>
      
      {/* 消息列表 - 确保可以滚动 */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full text-gray-500 dark:text-gray-400">
            <p>开始一个新的对话</p>
            <p className="text-sm">在下方输入框中输入你的问题</p>
          </div>
        ) : (
          messages.map((message) => (
            <div 
              key={message.id} 
              className={`flex flex-col ${
                message.role === 'user' ? 'items-end' : 'items-start'
              }`}
            >
              <Card 
                className={`max-w-[80%] ${
                  message.role === 'user' 
                    ? 'bg-primary text-primary-foreground' 
                    : message.streaming ? 'bg-muted border animate-pulse-border' : 'bg-muted'
                }`}
              >
                <CardContent className="p-3">
                  {message.role === 'assistant' ? (
                    message.content ? (
                      <Markdown
                        content={message.content}
                        className={message.streaming 
                          ? 'streaming-content' 
                          : message.canceled 
                            ? 'canceled-message' 
                            : ''}
                      />
                    ) : message.streaming ? (
                      <div className="h-5 w-5">
                        <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
                      </div>
                    ) : (
                      <p className="text-gray-500">无内容</p>
                    )
                  ) : (
                    <p className="whitespace-pre-wrap">{message.content}</p>
                  )}
                </CardContent>
              </Card>
              <span className="text-xs text-gray-500 mt-1">
                {formatTime(message.timestamp)}
                {message.streaming && ' · 正在生成...'}
                {message.canceled && ' · 已中断'}
              </span>
            </div>
          ))
        )}
        <div ref={messagesEndRef} />
      </div>
      
      {/* 输入框 */}
      <div className="border-t border-gray-200 dark:border-gray-800 p-4">
        <div className="flex items-center space-x-2">
          <Input
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                handleSendMessage();
              }
            }}
            placeholder="输入消息..."
            className="flex-1"
            disabled={isLoading}
          />
          {isLoading ? (
            <Button
              onClick={handleStopGeneration}
              className="cursor-pointer bg-red-600 hover:bg-red-700 text-white"
              title="停止生成"
              variant="destructive"
            >
              <Square className="h-4 w-4" fill="currentColor" />
              <span className="ml-1">停止</span>
            </Button>
          ) : (
            <Button
              onClick={handleSendMessage}
              disabled={!input.trim() || !selectedModel}
              className="cursor-pointer"
            >
              <Send className="h-5 w-5" />
            </Button>
          )}
        </div>
      </div>
    </div>
  );
};

export default ChatInterface; 