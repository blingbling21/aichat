"use client";

import { FC, useState, useRef, useEffect } from 'react';
import { Send, Loader2 } from 'lucide-react';
import { Message } from '../types';
import { aiService } from '../services/ai';
import { storageService } from '../services/storage';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";

/**
 * 聊天界面组件
 * 包含消息列表和发送消息功能
 */
const ChatInterface: FC = () => {
  // 聊天消息状态
  const [messages, setMessages] = useState<Message[]>(() => {
    // 尝试从本地存储加载历史聊天记录
    try {
      const savedMessages = window.localStorage.getItem('chatHistory');
      if (savedMessages) {
        const parsedMessages = JSON.parse(savedMessages);
        // 确保timestamp是Date对象
        return parsedMessages.map((msg: Omit<Message, 'timestamp'> & { timestamp: string }) => ({
          ...msg,
          timestamp: new Date(msg.timestamp)
        }));
      }
    } catch (error) {
      console.error('加载聊天历史失败:', error);
    }
    return [];
  });
  // 输入框内容状态
  const [input, setInput] = useState('');
  // 加载状态
  const [isLoading, setIsLoading] = useState(false);
  // 当前选中的AI模型
  const [selectedModel, setSelectedModel] = useState(() => storageService.getSelectedProviderId());
  // 可用的AI模型列表
  const [aiModels, setAiModels] = useState(aiService.getAvailableProviders());
  
  // 聊天容器引用，用于自动滚动
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 加载AI提供商列表
  useEffect(() => {
    const providers = aiService.getAvailableProviders();
    if (providers.length > 0) {
      setAiModels(providers);
    } else {
      // 默认提供商
      setAiModels([{
        id: 'default',
        name: 'ChatGPT',
        apiEndpoint: 'https://api.openai.com/v1/chat/completions',
        apiKey: ''
      }]);
    }
  }, []);
  
  // 监听selectedModel变化并保存到本地存储
  useEffect(() => {
    storageService.saveSelectedProviderId(selectedModel);
  }, [selectedModel]);
  
  // 保存聊天历史到本地存储
  useEffect(() => {
    if (messages.length > 0) {
      try {
        window.localStorage.setItem('chatHistory', JSON.stringify(messages));
      } catch (error) {
        console.error('保存聊天历史失败:', error);
      }
    }
  }, [messages]);
  
  // 消息发送处理函数
  const handleSendMessage = async () => {
    if (!input.trim() || isLoading) return;
    
    // 创建用户消息
    const userMessage: Message = {
      id: Date.now().toString(),
      content: input,
      role: 'user',
      timestamp: new Date()
    };
    
    // 更新消息列表
    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);
    
    try {
      // 传递完整的聊天历史以保持上下文
      const history = updatedMessages.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
      // 调用AI服务发送消息
      const aiResponse = await aiService.sendMessage(input, selectedModel, history);
      setMessages(prev => [...prev, aiResponse]);
    } catch (error) {
      console.error('发送消息失败:', error);
      // 添加错误消息
      const errorMessage: Message = {
        id: Date.now().toString(),
        content: '发送消息失败，请检查网络或API设置。',
        role: 'assistant',
        timestamp: new Date()
      };
      setMessages(prev => [...prev, errorMessage]);
    } finally {
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
    window.localStorage.removeItem('chatHistory');
  };

  return (
    <div className="flex flex-col h-full">
      {/* 头部 */}
      <div className="border-b border-gray-200 dark:border-gray-800 p-4">
        <div className="flex items-center justify-between">
          <h1 className="text-xl font-semibold">聊天</h1>
          <div className="flex items-center gap-2">
            <Select value={selectedModel} onValueChange={setSelectedModel}>
              <SelectTrigger className="w-[180px]">
                <SelectValue placeholder="选择AI模型" />
              </SelectTrigger>
              <SelectContent>
                {aiModels.map(model => (
                  <SelectItem key={model.id} value={model.id}>
                    {model.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            
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
              <Card className={`max-w-[80%] ${
                message.role === 'user' 
                  ? 'bg-primary text-primary-foreground' 
                  : 'bg-muted'
              }`}>
                <CardContent className="p-3">
                  <p className="whitespace-pre-wrap">{message.content}</p>
                </CardContent>
              </Card>
              <span className="text-xs text-gray-500 mt-1">
                {formatTime(message.timestamp)}
              </span>
            </div>
          ))
        )}
        {isLoading && (
          <div className="flex items-start">
            <Card className="bg-muted">
              <CardContent className="p-3">
                <Loader2 className="h-5 w-5 animate-spin text-gray-500" />
              </CardContent>
            </Card>
          </div>
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
          />
          <Button
            onClick={handleSendMessage}
            disabled={isLoading || !input.trim()}
            className="cursor-pointer"
          >
            {isLoading ? (
              <Loader2 className="h-5 w-5 animate-spin" />
            ) : (
              <Send className="h-5 w-5" />
            )}
          </Button>
        </div>
      </div>
    </div>
  );
};

export default ChatInterface; 