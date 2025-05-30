"use client";

import { FC, useState, useRef, useEffect } from 'react';
import { useParams, useRouter } from 'next/navigation';
import { Send, Loader2, Square, ArrowLeft, MessageSquare, Settings, Trash2 } from 'lucide-react';
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent } from "@/components/ui/card";
import { Markdown } from "@/components/ui/markdown";
import { Message, Agent, AgentSession } from '../../../types';
import { storageService } from '../../../services/storage';
import { aiService } from '../../../services/ai';
import { logService } from '../../../services/log';
import { toast } from "sonner";
import { MainLayout } from '../../../components';

const AgentChatPage: FC = () => {
  const params = useParams();
  const router = useRouter();
  const agentId = params.id as string;
  
  const [agent, setAgent] = useState<Agent | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [input, setInput] = useState('');
  const [messages, setMessages] = useState<Message[]>([]);
  const [sessions, setSessions] = useState<AgentSession[]>([]);
  const [currentSession, setCurrentSession] = useState<string | null>(null);

  // 聊天容器引用，用于自动滚动
  const messagesEndRef = useRef<HTMLDivElement>(null);

  // 加载Agent和会话
  useEffect(() => {
    const loadedAgent = storageService.getAgent(agentId);
    if (!loadedAgent) {
      toast.error("找不到AI代理");
      router.push('/agents');
      return;
    }
    
    setAgent(loadedAgent);
    
    // 加载该Agent的所有会话
    const agentSessions = storageService.getAgentSessionsByAgentId(agentId);
    setSessions(agentSessions);
    
    // 如果有会话，加载最近的一个
    if (agentSessions.length > 0) {
      // 按更新时间排序，最新的在前
      const sortedSessions = [...agentSessions].sort(
        (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
      );
      const latestSession = sortedSessions[0];
      setCurrentSession(latestSession.id);
      
      // 确保历史消息的streaming状态为false，并过滤掉空内容的消息
      const cleanedMessages = latestSession.messages
        .filter(msg => msg.content.trim() !== '' || msg.streaming) // 过滤掉空内容的非流式消息
        .map(msg => ({
          ...msg,
          streaming: false
        }));
      
      setMessages(cleanedMessages);
      logService.info(`已加载会话: ${latestSession.name}`);
    }
  }, [agentId, router]);

  // 处理发送消息
  const handleSendMessage = async () => {
    if (!input.trim() || isLoading || !agent) return;
    
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
      streaming: true
    };
    
    // 更新UI中的消息列表
    const updatedMessages = [...messages, userMessage, assistantMessage];
    setMessages(updatedMessages);
    setInput('');
    setIsLoading(true);
    
    // 如果没有当前会话或需要创建新会话
    if (!currentSession) {
      const newSession: AgentSession = {
        id: Date.now().toString(),
        agentId,
        name: `与 ${agent.name} 的对话`,
        messages: updatedMessages,
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      storageService.saveAgentSession(newSession);
      setCurrentSession(newSession.id);
      setSessions(prev => [newSession, ...prev]);
    } else {
      // 更新现有会话
      const session = storageService.getAgentSession(currentSession);
      if (session) {
        const updatedSession = {
          ...session,
          messages: updatedMessages,
          updatedAt: new Date()
        };
        storageService.saveAgentSession(updatedSession);
      }
    }
    
    try {
      // 限制历史消息数量
      let historyToSend = messages.filter(msg => !msg.streaming);
      if (agent.keepHistory && agent.maxHistoryMessages && historyToSend.length > agent.maxHistoryMessages) {
        historyToSend = historyToSend.slice(-agent.maxHistoryMessages);
      } else if (!agent.keepHistory) {
        historyToSend = [];
      }
      
      // 转换为AI服务所需的格式
      const history = historyToSend.map(msg => ({
        role: msg.role,
        content: msg.content
      }));
      
      // 添加用户当前消息
      history.push({
        role: userMessage.role,
        content: userMessage.content
      });
      
      // 发送消息到Agent
      await aiService.sendAgentMessage(
        input,
        agentId,
        history,
        (content, done, error) => {
          setMessages(prevMessages => {
            return prevMessages.map(msg => {
              if (msg.id === assistantMessageId) {
                return {
                  ...msg,
                  content: content,
                  streaming: !done,
                  canceled: done && error ? true : undefined
                };
              }
              return msg;
            });
          });
          
          if (done) {
            setIsLoading(false);
            
            // 更新会话
            if (currentSession) {
              const session = storageService.getAgentSession(currentSession);
              if (session) {
                const finalMessages = session.messages.map(msg => 
                  msg.id === assistantMessageId 
                    ? { ...msg, content, streaming: false, canceled: error ? true : undefined }
                    : msg
                );
                
                const updatedSession = {
                  ...session,
                  messages: finalMessages,
                  updatedAt: new Date()
                };
                
                storageService.saveAgentSession(updatedSession);
              }
            }
          }
        }
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
                streaming: false,
                canceled: true
              }
            : msg
        )
      );
      setIsLoading(false);
      
      toast.error("发送消息失败");
    }
  };

  // 处理停止生成
  const handleStopGeneration = () => {
    logService.info('用户请求停止生成');
    aiService.cancelStream();
  };
  
  // 创建新会话
  const handleNewSession = () => {
    if (agent) {
      const newSession: AgentSession = {
        id: Date.now().toString(),
        agentId,
        name: `与 ${agent.name} 的新对话`,
        messages: [],
        createdAt: new Date(),
        updatedAt: new Date()
      };
      
      storageService.saveAgentSession(newSession);
      setCurrentSession(newSession.id);
      setMessages([]);
      setSessions(prev => [newSession, ...prev]);
      
      logService.info(`已创建新会话: ${newSession.name}`);
    }
  };
  
  // 切换会话
  const handleSwitchSession = (sessionId: string) => {
    const session = storageService.getAgentSession(sessionId);
    if (session) {
      setCurrentSession(sessionId);
      
      // 确保历史消息的streaming状态为false，并过滤掉空内容的消息
      const cleanedMessages = session.messages
        .filter(msg => msg.content.trim() !== '' || msg.streaming) // 过滤掉空内容的非流式消息
        .map(msg => ({
          ...msg,
          streaming: false
        }));
      
      setMessages(cleanedMessages);
      logService.info(`已切换到会话: ${session.name}`);
    }
  };
  
  // 删除会话
  const handleDeleteSession = (sessionId: string, event: React.MouseEvent) => {
    // 阻止事件冒泡，避免触发切换会话
    event.stopPropagation();
    
    if (window.confirm('确定要删除这个对话吗？此操作无法撤销。')) {
      // 从存储中删除会话
      storageService.deleteAgentSession(sessionId);
      
      // 更新本地会话列表
      setSessions(prev => prev.filter(s => s.id !== sessionId));
      
      // 如果删除的是当前会话，需要切换到其他会话或清空
      if (currentSession === sessionId) {
        const remainingSessions = sessions.filter(s => s.id !== sessionId);
        if (remainingSessions.length > 0) {
          // 切换到最新的会话
          const latestSession = remainingSessions.sort(
            (a, b) => b.updatedAt.getTime() - a.updatedAt.getTime()
          )[0];
          handleSwitchSession(latestSession.id);
        } else {
          // 没有其他会话了，清空当前状态
          setCurrentSession(null);
          setMessages([]);
        }
      }
      
      logService.info(`已删除会话: ${sessionId}`);
      toast.success('对话已删除');
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

  return (
    <MainLayout>
      <div className="flex flex-col h-full">
        {/* 头部 */}
        <div className="border-b border-gray-200 dark:border-gray-800 p-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center">
              <Button 
                variant="outline" 
                size="sm"
                className="mr-2"
                onClick={() => router.push('/agents')}
              >
                <ArrowLeft size={16} />
              </Button>
              <h1 className="text-xl font-semibold">
                {agent ? agent.name : '加载中...'}
              </h1>
            </div>
            
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                onClick={handleNewSession}
                className="cursor-pointer"
              >
                <MessageSquare size={16} className="mr-1" />
                新对话
              </Button>
              
              <Button
                variant="outline"
                size="sm"
                onClick={() => agent && router.push(`/agents/${agent.id}/edit`)}
                className="cursor-pointer"
              >
                <Settings size={16} className="mr-1" />
                编辑代理
              </Button>
            </div>
          </div>
          
          {agent && (
            <p className="text-sm text-gray-500 mt-1">{agent.description}</p>
          )}
        </div>
        
        {/* 主体内容 - 使用Flex布局 */}
        <div className="flex flex-1 overflow-hidden">
          {/* 会话侧边栏 */}
          {sessions.length > 0 && (
            <div className="w-64 border-r border-gray-200 dark:border-gray-800 overflow-y-auto">
              <div className="p-4">
                <h2 className="text-sm font-medium mb-2">对话历史</h2>
                <div className="space-y-1">
                  {sessions.map(session => (
                    <div 
                      key={session.id}
                      className={`group relative p-2 rounded-md cursor-pointer text-sm hover:bg-gray-100 dark:hover:bg-gray-800 ${
                        currentSession === session.id ? 'bg-gray-100 dark:bg-gray-800' : ''
                      }`}
                      onClick={() => handleSwitchSession(session.id)}
                    >
                      <div className="flex items-center justify-between">
                        <span className="truncate flex-1 pr-2">{session.name}</span>
                        <Button
                          variant="ghost"
                          size="sm"
                          className="opacity-0 group-hover:opacity-100 h-6 w-6 p-0 text-red-500 hover:text-red-700 hover:bg-red-50 dark:hover:bg-red-900/20"
                          onClick={(event) => handleDeleteSession(session.id, event)}
                          title="删除对话"
                        >
                          <Trash2 size={12} />
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}
          
          {/* 聊天内容区 */}
          <div className="flex-1 flex flex-col overflow-hidden">
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
                  disabled={isLoading || !agent}
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
                    disabled={!input.trim() || !agent}
                    className="cursor-pointer"
                  >
                    <Send className="h-5 w-5" />
                  </Button>
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default AgentChatPage; 