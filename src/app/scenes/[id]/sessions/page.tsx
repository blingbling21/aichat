"use client";

import { FC, useEffect, useState } from 'react';
import { useRouter, useParams } from 'next/navigation';
import Link from 'next/link';
import { Plus, MessageSquare, ArrowLeft, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Scene, SceneSession } from '../../../types';
import { storageService } from '../../../services/storage';
import { MainLayout } from '../../../components';
import { toast } from 'sonner';

const SceneSessionsPage: FC = () => {
  const router = useRouter();
  const params = useParams();
  const sceneId = params.id as string;
  
  const [scene, setScene] = useState<Scene | null>(null);
  const [sessions, setSessions] = useState<SceneSession[]>([]);

  useEffect(() => {
    // 加载场景和会话
    const loadScene = () => {
      const loadedScene = storageService.getScene(sceneId);
      if (loadedScene) {
        setScene(loadedScene);
        
        // 加载该场景的会话
        const loadedSessions = storageService.getSceneSessionsBySceneId(sceneId);
        setSessions(loadedSessions);
      } else {
        toast.error("找不到场景");
        router.push('/scenes');
      }
    };

    loadScene();
    
    // 监听存储变化
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'aiSceneSessions' || e.key === 'aiScenes') {
        loadScene();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, [sceneId, router]);

  // 创建新会话
  const createNewSession = () => {
    if (!scene) return;
    
    const newSession: SceneSession = {
      id: Date.now().toString(),
      sceneId: scene.id,
      name: `${scene.name} 会话 ${new Date().toLocaleString()}`,
      messages: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      isActive: true
    };
    
    storageService.saveSceneSession(newSession);
    
    // 直接跳转到新会话
    router.push(`/scenes/${sceneId}/sessions/${newSession.id}`);
  };

  // 删除会话
  const handleDeleteSession = (sessionId: string) => {
    if (window.confirm("确定要删除这个会话吗？所有对话记录将会丢失。")) {
      try {
        storageService.deleteSceneSession(sessionId);
        setSessions(sessions.filter(s => s.id !== sessionId));
        toast.success("会话已删除");
      } catch (error) {
        toast.error(`删除会话失败: ${error instanceof Error ? error.message : '未知错误'}`);
      }
    }
  };

  if (!scene) {
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
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <div className="flex items-center">
            <Button 
              variant="outline" 
              size="sm"
              className="mr-2"
              onClick={() => router.push('/scenes')}
            >
              <ArrowLeft size={16} className="mr-1" />
              返回
            </Button>
            <h1 className="text-2xl font-bold">{scene.name} - 会话</h1>
          </div>
          <Button onClick={createNewSession}>
            <Plus size={16} className="mr-2" />
            新建会话
          </Button>
        </div>

        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-2">场景描述</h2>
          <p className="text-gray-600">{scene.description}</p>
        </div>

        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-2">参与者</h2>
          <div className="flex flex-wrap gap-2">
            {scene.participants.map(participant => {
              const agent = storageService.getAgent(participant.agentId);
              return (
                <div key={participant.id} className="px-3 py-1 bg-secondary rounded-full text-sm">
                  {participant.role} {agent ? `(${agent.name})` : ''}
                </div>
              );
            })}
          </div>
        </div>

        <h2 className="text-xl font-semibold mb-4">会话记录</h2>
        
        {sessions.length === 0 ? (
          <div className="text-center p-10 bg-muted/30 rounded-lg">
            <p className="text-muted-foreground mb-4">还没有会话记录</p>
            <Button onClick={createNewSession} variant="secondary">
              <Plus size={16} className="mr-2" />
              开始第一个会话
            </Button>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {sessions.map(session => (
              <Card key={session.id} className="overflow-hidden">
                <CardHeader className="pb-4">
                  <CardTitle className="text-lg">{session.name}</CardTitle>
                  <CardDescription>
                    创建于: {new Date(session.createdAt).toLocaleString()}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground">
                    消息数: {session.messages.length}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    最后活动: {new Date(session.updatedAt).toLocaleString()}
                  </p>
                </CardContent>
                <CardFooter className="flex justify-between pt-2">
                  <Link href={`/scenes/${sceneId}/sessions/${session.id}`}>
                    <Button variant="outline" size="sm">
                      <MessageSquare size={14} className="mr-1" />
                      查看对话
                    </Button>
                  </Link>
                  <Button
                    variant="ghost"
                    size="sm"
                    onClick={() => handleDeleteSession(session.id)}
                    className="text-destructive"
                  >
                    <Trash2 size={14} />
                  </Button>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default SceneSessionsPage; 