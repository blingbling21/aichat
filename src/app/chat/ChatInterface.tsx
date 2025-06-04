"use client";

import { FC, useState, useRef, useEffect } from 'react';
import { Send, Loader2, Square, Image, Video, Mic, Brain } from 'lucide-react';
import { Message, AIProvider, AIModel } from '../types';
import { aiService } from '../services/ai';
import { storageService } from '../services/storage';
import { logService } from '../services/log';
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Card, CardContent } from "@/components/ui/card";
import { Markdown } from "@/components/ui/markdown";
import { Checkbox } from "@/components/ui/checkbox";
import { toast } from "sonner";

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
  // 当前选中的模型
  const [selectedModelData, setSelectedModelData] = useState<AIModel | null>(null);
  // 流式模式开关
  const [isStreamMode, setIsStreamMode] = useState(true);
  // 温度设置状态
  const [temperature, setTemperature] = useState<number>(0.7);
  // 温度输入状态
  const [isEditingTemperature, setIsEditingTemperature] = useState(false);
  const [tempInputValue, setTempInputValue] = useState('');
  
  // 智能滚动状态
  const [shouldAutoScroll, setShouldAutoScroll] = useState(true);
  
  // 聊天容器引用，用于自动滚动
  const messagesEndRef = useRef<HTMLDivElement>(null);
  // 消息容器引用，用于监听滚动事件
  const messagesContainerRef = useRef<HTMLDivElement>(null);

  // 加载本地存储的数据，确保在客户端执行
  useEffect(() => {
    // 加载流式模式设置
    try {
      const savedStreamMode = storageService.getStreamMode();
      setIsStreamMode(savedStreamMode);
      logService.info(`已加载流式模式设置: ${savedStreamMode}`);
    } catch (error) {
      console.error('加载流式模式设置失败:', error);
      logService.error('加载流式模式设置失败', error);
    }
    
    // 加载聊天历史
    try {
      const savedMessages = localStorage.getItem('chatHistory');
      if (savedMessages) {
        const parsedMessages = JSON.parse(savedMessages);
        // 确保timestamp是Date对象，清除streaming状态，并过滤掉空内容的消息
        setMessages(parsedMessages
          .filter((msg: Omit<Message, 'timestamp'> & { timestamp: string }) => msg.content && msg.content.trim() !== '') // 过滤掉空内容的消息
          .map((msg: Omit<Message, 'timestamp'> & { timestamp: string }) => ({
            ...msg,
            timestamp: new Date(msg.timestamp),
            streaming: false // 确保历史消息不显示为正在生成状态
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
            
            // 尝试加载保存的模型ID
            const savedModelId = storageService.getSelectedModelId();
            const modelExists = selectedProviderData.models.some(m => m.id === savedModelId);
            
            if (savedModelId && modelExists) {
              // 如果有保存的模型ID并且该模型存在于当前提供商，使用保存的模型
              setSelectedModel(savedModelId);
              logService.info(`已恢复选中的模型ID: ${savedModelId}`);
            } else if (selectedProviderData.defaultModelId) {
              // 否则使用默认模型
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
  
  // 监听模型变化，更新模型数据
  useEffect(() => {
    if (selectedModel && availableModels.length > 0) {
      const model = availableModels.find(m => m.id === selectedModel);
      setSelectedModelData(model || null);
      
      // 保存选中的模型ID到本地存储
      storageService.saveSelectedModelId(selectedModel);
      logService.debug(`当前选中模型: ${model?.id || '未知'}, 已保存模型ID: ${selectedModel}`);
    } else {
      setSelectedModelData(null);
    }
  }, [selectedModel, availableModels]);
  
  // 保存聊天历史到本地存储
  useEffect(() => {
    try {
      if (messages.length > 0) {
        localStorage.setItem('chatHistory', JSON.stringify(messages));
        logService.debug(`已保存 ${messages.length} 条聊天历史记录`);
      } else {
        // 当消息为空时，也要清空localStorage
        localStorage.removeItem('chatHistory');
        logService.debug('已清空聊天历史记录');
      }
    } catch (error) {
      console.error('保存聊天历史失败:', error);
      logService.error('保存聊天历史失败', error);
    }
  }, [messages]);
  
  // 加载温度设置
  useEffect(() => {
    try {
      const savedTemperature = localStorage.getItem('chatTemperature');
      if (savedTemperature) {
        const temp = parseFloat(savedTemperature);
        if (!isNaN(temp) && temp >= 0 && temp <= 2) {
          setTemperature(temp);
          logService.info(`已加载温度设置: ${temp}`);
        }
      }
    } catch (error) {
      console.error('加载温度设置失败:', error);
      logService.error('加载温度设置失败', error);
    }
  }, []);
  
  // 保存温度设置
  const handleTemperatureChange = (newTemperature: number) => {
    setTemperature(newTemperature);
    localStorage.setItem('chatTemperature', newTemperature.toString());
    logService.info(`温度设置已更新: ${newTemperature}`);
  };

  // 开始编辑温度
  const startEditingTemperature = () => {
    setTempInputValue(temperature.toString());
    setIsEditingTemperature(true);
  };

  // 完成温度编辑
  const finishEditingTemperature = () => {
    const newTemp = parseFloat(tempInputValue);
    if (!isNaN(newTemp) && newTemp >= 0 && newTemp <= 2) {
      // 保留最多3位小数
      const roundedTemp = Math.round(newTemp * 1000) / 1000;
      handleTemperatureChange(roundedTemp);
    }
    setIsEditingTemperature(false);
  };

  // 取消温度编辑
  const cancelEditingTemperature = () => {
    setIsEditingTemperature(false);
    setTempInputValue('');
  };

  // 处理温度输入变化
  const handleTempInputChange = (value: string) => {
    // 允许数字、小数点，支持多位小数
    if (/^\d*\.?\d{0,3}$/.test(value)) {
      setTempInputValue(value);
    }
  };

  // 检测是否滚动到底部
  const isScrolledToBottom = () => {
    if (!messagesContainerRef.current) return true;
    
    const container = messagesContainerRef.current;
    const threshold = 50; // 50px的容差，考虑到滚动的精确性
    
    return Math.abs(
      container.scrollHeight - container.clientHeight - container.scrollTop
    ) <= threshold;
  };

  // 处理滚动事件
  const handleScroll = () => {
    if (!messagesContainerRef.current) return;
    
    const isAtBottom = isScrolledToBottom();
    
    // 如果用户滚动到底部，恢复自动滚动
    if (isAtBottom && !shouldAutoScroll) {
      setShouldAutoScroll(true);
      logService.debug('用户滚动到底部，恢复自动滚动');
    }
    // 如果用户向上滚动且不在底部，停止自动滚动
    else if (!isAtBottom && shouldAutoScroll) {
      setShouldAutoScroll(false);
      logService.debug('用户向上滚动，停止自动滚动');
    }
  };

  // 智能滚动到底部
  const scrollToBottom = () => {
    if (shouldAutoScroll && messagesEndRef.current) {
      messagesEndRef.current.scrollIntoView({ behavior: 'smooth' });
    }
  };

  // 强制滚动到底部（用于发送新消息时）
  const forceScrollToBottom = () => {
    setShouldAutoScroll(true);
    setTimeout(() => {
      messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
    }, 100);
  };

  // 处理停止生成
  const handleStopGeneration = () => {
    logService.info('用户请求停止生成');
    aiService.cancelStream();
  };

  // 流式消息更新处理函数
  const handleStreamUpdate = (assistantMessageId: string, content: string, done: boolean, error?: boolean, reasoningContent?: string) => {
    setMessages(prevMessages => {
      return prevMessages.map(msg => {
        if (msg.id === assistantMessageId) {
          // 生成中始终展开，生成完成后自动折叠（有推理内容时）
          let reasoningCollapsed = msg.reasoningCollapsed;
          if (reasoningContent !== undefined) {
            if (!done) {
              reasoningCollapsed = false;
            } else {
              reasoningCollapsed = true;
            }
          }
          return {
            ...msg,
            content: content,
            reasoningContent: reasoningContent !== undefined ? reasoningContent : msg.reasoningContent,
            streaming: !done,
            reasoningCollapsed,
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
        if (reasoningContent) {
          logService.info(`推理内容: ${reasoningContent.substring(0, 50)}${reasoningContent.length > 50 ? '...' : ''}`);
        }
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
    
    // 使用函数式更新来获取最新的messages状态
    setMessages(currentMessages => {
      logService.info(`发送前当前messages状态: 共${currentMessages.length}条消息`);
      currentMessages.forEach((msg, index) => {
        logService.info(`  现有消息[${index}] ${msg.role}: ${msg.content.substring(0, 50)}${msg.content.length > 50 ? '...' : ''}`);
      });
      
      // 构建历史记录（使用当前最新的状态）
      const history = [...currentMessages, userMessage]
        .filter(msg => !msg.streaming && msg.content.trim() !== '') // 过滤掉正在流式生成的消息和空消息
        .map(msg => ({
          role: msg.role,
          content: msg.content
        }));
      
      logService.debug(`构建历史记录，当前messages数量: ${currentMessages.length}, 构建后history数量: ${history.length}`);
      if (history.length > 0) {
        logService.debug(`历史记录内容: ${JSON.stringify(history.map(h => ({ role: h.role, content: h.content.substring(0, 30) + '...' })))}`);
      } else {
        logService.debug('无历史记录，这是新的对话开始');
      }
      
      // 异步发送消息（不在setState回调中执行）
      setTimeout(async () => {
        try {
          logService.debug(`使用提供商 ${selectedProvider} 的模型 ${selectedModel} ${isStreamMode ? '流式' : '非流式'}发送消息`);
          logService.info(`🌡️ 当前温度设置: ${temperature}`);
          
          if (isStreamMode) {
            // 调用AI服务发送流式消息
            await aiService.sendMessageStream(
              input, 
              (content, done, error, reasoningContent) => handleStreamUpdate(assistantMessageId, content, done, error, reasoningContent),
              selectedProvider, 
              history, 
              selectedModel,
              temperature
            );
          } else {
            // 调用AI服务发送非流式消息
            const response = await aiService.sendMessage(
              input,
              selectedProvider,
              history,
              selectedModel,
              temperature
            );
            
            // 更新助手消息
            setMessages(prev => 
              prev.map(msg => 
                msg.id === assistantMessageId 
                  ? {
                      ...msg,
                      content: response.content,
                      reasoningContent: response.reasoningContent,
                      streaming: false
                    }
                  : msg
              )
            );
            setIsLoading(false);
          }
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
      }, 0);
      
      // 返回新的状态：添加用户消息和初始空的助手消息
      return [...currentMessages, userMessage, assistantMessage];
    });
    
    setInput('');
    setIsLoading(true);
    
    // 发送新消息后强制滚动到底部
    forceScrollToBottom();
  };
  
  // 自动滚动到最新消息
  useEffect(() => {
    scrollToBottom();
  }, [messages, shouldAutoScroll]);
  
  // 添加滚动事件监听器
  useEffect(() => {
    const container = messagesContainerRef.current;
    if (!container) return;
    
    // 使用防抖来避免频繁触发
    let timeoutId: NodeJS.Timeout;
    const debouncedHandleScroll = () => {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(handleScroll, 100);
    };
    
    container.addEventListener('scroll', debouncedHandleScroll, { passive: true });
    
    return () => {
      container.removeEventListener('scroll', debouncedHandleScroll);
      clearTimeout(timeoutId);
    };
  }, [shouldAutoScroll]); // 依赖shouldAutoScroll以便在状态变化时重新设置监听器
  
  // 格式化时间
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('zh-CN', { 
      hour: '2-digit', 
      minute: '2-digit'
    });
  };

  // 清除聊天记录
  const handleClearChat = () => {
    logService.info('开始清空聊天记录');
    logService.info(`清空前messages数量: ${messages.length}`);
    if (messages.length > 0) {
      logService.info(`清空前最后一条消息: ${messages[messages.length - 1].role}: ${messages[messages.length - 1].content.substring(0, 50)}...`);
    }
    setMessages([]);
    localStorage.removeItem('chatHistory');
    logService.info('已清空聊天记录和本地存储');
  };

  // 在组件内部增加切换折叠状态的函数
  const toggleReasoningCollapse = (msgId: string) => {
    setMessages(prevMessages => prevMessages.map(msg => {
      if (msg.id === msgId) {
        return { ...msg, reasoningCollapsed: !msg.reasoningCollapsed };
      }
      return msg;
    }));
  };

  // 检查当前提供商是否配置了流式响应
  const checkStreamConfig = () => {
    const provider = aiProviders.find(p => p.id === selectedProvider);
    if (!provider || !provider.customConfig) {
      return false;
    }
    return provider.customConfig.response.streamConfig?.enabled || false;
  };

  // 检查当前提供商是否配置了温度模板字段
  const checkTemperatureConfig = () => {
    const provider = aiProviders.find(p => p.id === selectedProvider);
    if (!provider || !provider.customConfig) {
      return false;
    }
    
    // 查找temperature字段配置
    const tempField = provider.customConfig.bodyFields.find(field => 
      field.path.toLowerCase().includes('temperature') && 
      field.valueType === 'template'
    );
    
    return !!tempField;
  };

  // 处理流式模式切换
  const handleStreamModeChange = (enabled: boolean) => {
    if (enabled && !checkStreamConfig()) {
      toast.error('当前提供商未配置流式响应解析，请在设置中完成配置后再启用流式模式');
      return;
    }
    setIsStreamMode(enabled);
    storageService.saveStreamMode(enabled);
    logService.info(`流式模式已${enabled ? '启用' : '禁用'}并保存到本地`);
  };

  // 处理图片上传
  const handleImageUpload = () => {
    // 图片上传功能实现
    toast.info('图片上传功能还在开发中');
    logService.info('用户请求上传图片');
  };

  // 处理视频上传
  const handleVideoUpload = () => {
    // 视频上传功能实现
    toast.info('视频上传功能还在开发中');
    logService.info('用户请求上传视频');
  };

  // 处理语音输入
  const handleVoiceInput = () => {
    // 语音输入功能实现
    toast.info('语音输入功能还在开发中');
    logService.info('用户请求语音输入');
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
                      {model.id}
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
      <div 
        ref={messagesContainerRef}
        className="flex-1 overflow-y-auto p-4 space-y-4"
        onScroll={handleScroll}
      >
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
                    <>
                      {/* u663eu793au63a8u7406u8fc7u7a0bu5185u5bb9 */}
                      {message.reasoningContent && (
                        <div className="mb-4 p-3 bg-gray-100 dark:bg-gray-800 rounded border-l-4 border-yellow-500">
                          <div className="font-semibold mb-1 text-yellow-600 dark:text-yellow-400 flex items-center justify-between">
                            <span className="mr-1">推理过程</span>
                            <button
                              className="text-xs text-blue-500 hover:underline ml-2 focus:outline-none"
                              onClick={() => toggleReasoningCollapse(message.id)}
                              tabIndex={0}
                            >
                              {message.reasoningCollapsed ? '展开' : '收起'}
                            </button>
                          </div>
                          {message.reasoningCollapsed ? (
                            <div className="text-gray-700 dark:text-gray-300 cursor-pointer select-none" onClick={() => toggleReasoningCollapse(message.id)}>
                              {/* 只显示前2行或100字 */}
                              {(() => {
                                const lines = message.reasoningContent.split('\n');
                                const preview = lines.slice(0, 2).join('\n');
                                if (preview.length > 100) {
                                  return preview.slice(0, 100) + '...';
                                } else if (lines.length > 2) {
                                  return preview + '...';
                                } else {
                                  return preview;
                                }
                              })()}
                            </div>
                          ) : (
                            <Markdown 
                              content={message.reasoningContent} 
                              className={message.streaming ? 'streaming-content' : ''}
                            />
                          )}
                        </div>
                      )}
                      
                      {/* u663eu793au5b9eu9645u56deu7b54u5185u5bb9 */}
                      {message.content ? (
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
                      )}
                    </>
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
        
        {/* 新消息提示 - 当用户向上滚动时显示 */}
        {!shouldAutoScroll && messages.length > 0 && (
          <div className="sticky bottom-4 flex justify-center">
            <button
              onClick={() => {
                setShouldAutoScroll(true);
                messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
              }}
              className="bg-blue-500 hover:bg-blue-600 text-white px-4 py-2 rounded-full shadow-lg transition-all duration-200 flex items-center space-x-2"
            >
              <span>📩</span>
              <span>滚动到最新消息</span>
            </button>
          </div>
        )}
      </div>
      
      {/* 输入框 */}
      <div className="border-t border-gray-200 dark:border-gray-800 p-4">
        {/* 模型功能按钮区 */}
        {selectedModelData && selectedModelData.features && (
          <div className="mb-2 flex flex-wrap gap-1">
            {selectedModelData.features.image && (
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                title="上传图片"
                onClick={handleImageUpload}
                disabled={isLoading}
              >
                <Image className="h-4 w-4" />
              </Button>
            )}
            
            {selectedModelData.features.video && (
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                title="上传视频"
                onClick={handleVideoUpload}
                disabled={isLoading}
              >
                <Video className="h-4 w-4" />
              </Button>
            )}
            
            {selectedModelData.features.voice && (
              <Button
                variant="outline"
                size="icon"
                className="h-8 w-8"
                title="语音输入"
                onClick={handleVoiceInput}
                disabled={isLoading}
              >
                <Mic className="h-4 w-4" />
              </Button>
            )}
            
            {selectedModelData.features.reasoning && (
              <div className="relative" title="推理能力">
              <Button
                variant="outline"
                size="icon"
                  className="h-8 w-8 opacity-70 cursor-not-allowed"
                disabled={true}
              >
                <Brain className="h-4 w-4" />
              </Button>
              </div>
            )}
          </div>
        )}
        
        {/* 流式模式开关和温度控制 */}
        <div className="mb-2 flex items-center space-x-4">
          <div className="flex items-center space-x-2">
            <Checkbox
              id="stream-mode"
              checked={isStreamMode}
              onCheckedChange={handleStreamModeChange}
              disabled={isLoading}
            />
            <label 
              htmlFor="stream-mode" 
              className="text-sm text-gray-600 dark:text-gray-400 cursor-pointer"
            >
              流式输出 {!checkStreamConfig() && isStreamMode && 
                <span className="text-red-500">（未配置流式响应解析）</span>
              }
            </label>
          </div>
          
          {/* 温度控制 */}
          {checkTemperatureConfig() && (
            <div className="flex items-center space-x-2">
              <span className="text-sm text-gray-600 dark:text-gray-400">温度:</span>
              {isEditingTemperature ? (
                <div className="flex items-center space-x-1">
                  <input
                    type="text"
                    value={tempInputValue}
                    onChange={(e) => handleTempInputChange(e.target.value)}
                    onBlur={finishEditingTemperature}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        finishEditingTemperature();
                      } else if (e.key === 'Escape') {
                        cancelEditingTemperature();
                      }
                    }}
                    className="w-16 px-2 py-1 text-xs border border-gray-300 rounded focus:outline-none focus:ring-1 focus:ring-blue-500 focus:border-blue-500"
                    placeholder="0.0-2.0"
                    autoFocus
                    disabled={isLoading}
                  />
                  <span className="text-xs text-gray-500">(0.0-2.0)</span>
                </div>
              ) : (
                <button
                  onClick={startEditingTemperature}
                  disabled={isLoading}
                  className="px-2 py-1 text-xs bg-gray-100 hover:bg-gray-200 dark:bg-gray-700 dark:hover:bg-gray-600 rounded border border-gray-300 dark:border-gray-600 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {temperature}
                </button>
              )}
            </div>
          )}
        </div>
        
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