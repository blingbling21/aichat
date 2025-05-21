"use client";

import { FC, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, MessageSquare, Pencil, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Scene } from '../types';
import { storageService } from '../services/storage';
import { MainLayout } from '../components';
import { toast } from 'sonner';

const ScenesPage: FC = () => {
  const [scenes, setScenes] = useState<Scene[]>([]);

  useEffect(() => {
    // 加载场景列表
    const loadScenes = () => {
      const loadedScenes = storageService.getScenes();
      setScenes(loadedScenes);
    };

    loadScenes();
    
    // 监听存储变化
    const handleStorageChange = (e: StorageEvent) => {
      if (e.key === 'aiScenes') {
        loadScenes();
      }
    };
    
    window.addEventListener('storage', handleStorageChange);
    return () => {
      window.removeEventListener('storage', handleStorageChange);
    };
  }, []);

  // 删除场景
  const handleDelete = (id: string, name: string) => {
    if (window.confirm(`确定要删除场景 "${name}" 吗？这将删除所有相关的会话记录。`)) {
      try {
        storageService.deleteScene(id);
        setScenes(scenes.filter(scene => scene.id !== id));
        toast.success(`已删除场景: ${name}`);
      } catch (error) {
        toast.error(`删除场景失败: ${error instanceof Error ? error.message : '未知错误'}`);
      }
    }
  };

  return (
    <MainLayout>
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">AI交互场景</h1>
          <Link href="/scenes/create/edit">
            <Button>
              <Plus size={16} className="mr-2" />
              创建新场景
            </Button>
          </Link>
        </div>

        {scenes.length === 0 ? (
          <div className="text-center p-10 bg-muted/30 rounded-lg">
            <p className="text-muted-foreground mb-4">还没有创建任何场景</p>
            <Link href="/scenes/create/edit">
              <Button variant="secondary">
                <Plus size={16} className="mr-2" />
                创建第一个场景
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {scenes.map(scene => (
              <Card key={scene.id} className="overflow-hidden">
                <CardHeader className="pb-4">
                  <CardTitle className="text-xl">{scene.name}</CardTitle>
                  <CardDescription className="line-clamp-2">
                    {scene.description}
                  </CardDescription>
                </CardHeader>
                <CardContent>
                  <p className="text-sm text-muted-foreground mb-2">
                    创建于: {new Date(scene.createdAt).toLocaleString()}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    参与者: {scene.participants.length} 个Agent
                  </p>
                </CardContent>
                <CardFooter className="flex justify-between pt-2">
                  <Link href={`/scenes/${scene.id}/sessions`}>
                    <Button variant="outline" size="sm">
                      <MessageSquare size={14} className="mr-1" />
                      开始对话
                    </Button>
                  </Link>
                  <div className="flex space-x-2">
                    <Link href={`/scenes/${scene.id}/edit`}>
                      <Button variant="ghost" size="sm">
                        <Pencil size={14} />
                      </Button>
                    </Link>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => handleDelete(scene.id, scene.name)}
                    >
                      <Trash2 size={14} className="text-destructive" />
                    </Button>
                  </div>
                </CardFooter>
              </Card>
            ))}
          </div>
        )}
      </div>
    </MainLayout>
  );
};

export default ScenesPage; 