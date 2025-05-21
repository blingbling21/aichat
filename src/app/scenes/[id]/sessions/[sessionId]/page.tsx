"use client";

import { FC, useEffect, useState, useRef } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { ArrowLeft, Send, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Textarea } from '@/components/ui/textarea';
import { Markdown } from '@/components/ui/markdown';
import { Scene, SceneSession, SceneMessage } from '../../../../types';
import { storageService } from '../../../../services/storage';
import { aiService } from '../../../../services/ai';
import { MainLayout } from '../../../../components';
import { toast } from 'sonner';

const SceneSessionChatPage: FC = () => {
  const router = useRouter();
  const params = useParams();
  const sceneId = params.id as string;
  const sessionId = params.sessionId as string;
  
  const [scene, setScene] = useState<Scene | null>(null);
  const [session, setSession] = useState<SceneSession | null>(null);
  const [inputValue, setInputValue] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [participantResponses, setParticipantResponses] = useState<Record<string, { content: string; done: boolean }>>({});
  
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const textareaRef = useRef<HTMLTextAreaElement>(null);

  // 加载场景和会话
  useEffect(() => {
    const loadData = () => {
      const loadedScene = storageService.getScene(sceneId);
      if (!loadedScene) {
        toast.error("找不到场景");
        router.push('/scenes');
        return;
      }
      setScene(loadedScene);
      
      const loadedSession = storageService.getSceneSession(sessionId);
      if (!loadedSession) {
        toast.error("找不到会话");
        router.push(`/scenes/${sceneId}/sessions`);
        return;
      }
      setSession(loadedSession);
    };

    loadData();
    
    // 监听存储变化
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'aiSceneSessions' || e.key === 'aiScenes') {
        loadData();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [sceneId, sessionId, router]);

  // 滚动到底部
  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [session, participantResponses]);

  // 处理消息发送
  const handleSendMessage = async () => {
    if (!scene || !session || !inputValue.trim() || isLoading) return;
    
    setIsLoading(true);
    setParticipantResponses({});
    
    try {
      // 初始化对话处理
      await aiService.sendSceneMessage(
        sceneId,
        sessionId,
        inputValue.trim(),
        'user',
        (participantId, content, done) => {
          setParticipantResponses(prev => ({
            ...prev,
            [participantId]: { content, done }
          }));
        }
      );
      
      // 重新加载会话以获取最新消息
      const updatedSession = storageService.getSceneSession(sessionId);
      if (updatedSession) {
        setSession(updatedSession);
      }
      
      // 清空输入框
      setInputValue('');
      if (textareaRef.current) {
        textareaRef.current.focus();
      }
    } catch (error) {
      toast.error(`发送消息失败: ${error instanceof Error ? error.message : '未知错误'}`);
    } finally {
      setIsLoading(false);
      setParticipantResponses({});
    }
  };

  // 处理输入框按键
  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Enter' && !e.shiftKey) {
      e.preventDefault();
      handleSendMessage();
    }
  };

  // 获取参与者信息
  const getParticipantInfo = (participantId: string) => {
    if (participantId === 'user') {
      return { name: '用户', isUser: true };
    }
    
    if (scene) {
      const participant = scene.participants.find(p => p.id === participantId);
      if (participant) {
        const agent = storageService.getAgent(participant.agentId);
        return { 
          name: participant.role,
          agentName: agent?.name || '未知Agent',
          isUser: false 
        };
      }
    }
    
    return { name: '未知', isUser: false };
  };

  // 渲染消息气泡
  const renderMessage = (message: SceneMessage) => {
    const participant = getParticipantInfo(message.participantId);
    
    return (
      <div 
        key={message.id} 
        className={`mb-4 flex ${participant.isUser ? 'justify-end' : 'justify-start'}`}
      >
        <div 
          className={`rounded-lg px-4 py-2 max-w-[80%] ${
            participant.isUser 
              ? 'bg-primary text-primary-foreground' 
              : 'bg-muted'
          }`}
        >
          {!participant.isUser && (
            <div className="text-xs font-semibold mb-1 text-muted-foreground">
              {participant.name} {participant.agentName ? `(${participant.agentName})` : ''}
            </div>
          )}
          <Markdown content={message.content} />
        </div>
      </div>
    );
  };

  // 渲染正在回复中的消息
  const renderResponding = () => {
    if (!scene || Object.keys(participantResponses).length === 0) return null;
    
    return Object.entries(participantResponses).map(([participantId, response]) => {
      if (response.done) return null;
      
      const participant = getParticipantInfo(participantId);
      
      return (
        <div key={`responding-${participantId}`} className="mb-4 flex justify-start">
          <div className="rounded-lg px-4 py-2 max-w-[80%] bg-muted">
            <div className="text-xs font-semibold mb-1 text-muted-foreground">
              {participant.name} {participant.agentName ? `(${participant.agentName})` : ''}
            </div>
            <div className="flex items-center">
              <Loader2 size={16} className="animate-spin mr-2" />
              <span>正在回复...</span>
            </div>
          </div>
        </div>
      );
    });
  };

  if (!scene || !session) {
    return (
      <MainLayout>
        <div className="container mx-auto p-6 text-center">
          正在加载...
        </div>
      </MainLayout>
    );
  }

  return (
    <MainLayout>
      <div className="flex flex-col h-[calc(100vh-64px)]">
        {/* 头部 */}
        <div className="border-b p-4 flex items-center">
          <Button 
            variant="outline" 
            size="sm"
            className="mr-2"
            onClick={() => router.push(`/scenes/${sceneId}/sessions`)}
          >
            <ArrowLeft size={16} className="mr-1" />
            返回
          </Button>
          <div>
            <h1 className="text-xl font-bold">{scene.name}</h1>
            <p className="text-sm text-muted-foreground">{session.name}</p>
          </div>
        </div>
        
        {/* 消息区域 */}
        <div className="flex-1 overflow-y-auto p-4 space-y-4">
          {/* 场景信息提示 */}
          <div className="bg-muted/30 rounded-lg p-4 mb-4">
            <h3 className="font-semibold mb-2">场景背景</h3>
            <p className="text-sm text-muted-foreground mb-2">{scene.description}</p>
            
            <h3 className="font-semibold mb-2">参与者</h3>
            <div className="flex flex-wrap gap-2 mb-2">
              {scene.participants.map(participant => {
                const agent = storageService.getAgent(participant.agentId);
                return (
                  <div key={participant.id} className="px-3 py-1 bg-secondary rounded-full text-xs">
                    {participant.role} {agent ? `(${agent.name})` : ''}
                  </div>
                );
              })}
            </div>
            
            <p className="text-xs text-muted-foreground italic">
              你可以在下方输入消息与所有AI角色进行对话
            </p>
          </div>
          
          {/* 消息列表 */}
          {session.messages.length === 0 ? (
            <div className="text-center p-10">
              <p className="text-muted-foreground">开始和场景中的角色对话吧！</p>
            </div>
          ) : (
            <div className="space-y-4">
              {session.messages.map(renderMessage)}
            </div>
          )}
          
          {/* 正在回复的消息 */}
          {renderResponding()}
          
          <div ref={messagesEndRef} />
        </div>
        
        {/* 输入区域 */}
        <div className="border-t p-4">
          <div className="flex space-x-2">
            <Textarea
              ref={textareaRef}
              placeholder="输入消息..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              onKeyDown={handleKeyDown}
              className="flex-1 min-h-[80px]"
              disabled={isLoading}
            />
            <Button 
              onClick={handleSendMessage} 
              disabled={!inputValue.trim() || isLoading}
              className="self-end"
            >
              {isLoading ? (
                <Loader2 size={16} className="animate-spin" />
              ) : (
                <Send size={16} />
              )}
            </Button>
          </div>
        </div>
      </div>
    </MainLayout>
  );
};

export default SceneSessionChatPage; 