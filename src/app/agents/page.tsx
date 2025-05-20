"use client";

import { FC, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, Edit, Trash2, MessageSquare } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Agent } from '../types';
import { storageService } from '../services/storage';
import { logService } from '../services/log';
import { Dialog, DialogContent, DialogFooter, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { MainLayout } from '../components';

const AgentsPage: FC = () => {
  const [agents, setAgents] = useState<Agent[]>([]);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [agentToDelete, setAgentToDelete] = useState<string | null>(null);

  // 加载Agent列表
  useEffect(() => {
    const savedAgents = storageService.getAgents();
    setAgents(savedAgents);
    logService.info(`已加载 ${savedAgents.length} 个Agent`);
  }, []);

  // 打开删除确认对话框
  const openDeleteDialog = (id: string) => {
    setAgentToDelete(id);
    setDeleteDialogOpen(true);
  };

  // 删除Agent
  const handleDeleteAgent = () => {
    if (!agentToDelete) return;
    
    storageService.deleteAgent(agentToDelete);
    setAgents(agents.filter(agent => agent.id !== agentToDelete));
    
    setDeleteDialogOpen(false);
    setAgentToDelete(null);
    
    logService.info(`已删除Agent ID: ${agentToDelete}`);
  };

  // 格式化日期
  const formatDate = (date: Date) => {
    return date.toLocaleDateString('zh-CN', {
      year: 'numeric',
      month: 'long',
      day: 'numeric'
    });
  };

  return (
    <MainLayout>
      <div className="container mx-auto p-6">
        <div className="flex justify-between items-center mb-6">
          <h1 className="text-2xl font-bold">AI代理管理</h1>
          <Link href="/agents/create/edit">
            <Button className="cursor-pointer">
              <Plus size={16} className="mr-2" />
              创建新代理
            </Button>
          </Link>
        </div>

        {agents.length === 0 ? (
          <div className="text-center py-12 border rounded-lg bg-gray-50 dark:bg-gray-800">
            <h2 className="text-xl font-semibold mb-2">尚未创建任何AI代理</h2>
            <p className="text-gray-600 dark:text-gray-400 mb-4">
              创建您的第一个AI代理以开始特定任务的对话
            </p>
            <Link href="/agents/create/edit">
              <Button className="cursor-pointer">
                <Plus size={16} className="mr-2" />
                创建新代理
              </Button>
            </Link>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {agents.map(agent => (
              <Card key={agent.id} className="overflow-hidden">
                <CardContent className="p-0">
                  <div className="p-6">
                    <h2 className="text-xl font-semibold mb-1">{agent.name}</h2>
                    <p className="text-sm text-gray-500 mb-2">创建于: {formatDate(agent.createdAt)}</p>
                    <p className="text-gray-600 dark:text-gray-400 line-clamp-2 mb-4">
                      {agent.description}
                    </p>
                    <div className="flex space-x-2">
                      <Link href={`/agents/${agent.id}/chat`}>
                        <Button variant="outline" size="sm" className="cursor-pointer">
                          <MessageSquare size={14} className="mr-1" />
                          开始对话
                        </Button>
                      </Link>
                      <Link href={`/agents/${agent.id}/edit`}>
                        <Button variant="outline" size="sm" className="cursor-pointer">
                          <Edit size={14} className="mr-1" />
                          编辑
                        </Button>
                      </Link>
                      <Button 
                        variant="outline" 
                        size="sm"
                        className="text-red-500 hover:text-red-700 cursor-pointer"
                        onClick={() => openDeleteDialog(agent.id)}
                      >
                        <Trash2 size={14} className="mr-1" />
                        删除
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}

        {/* 删除确认对话框 */}
        <Dialog open={deleteDialogOpen} onOpenChange={setDeleteDialogOpen}>
          <DialogContent>
            <DialogHeader>
              <DialogTitle>确认删除</DialogTitle>
            </DialogHeader>
            <p>您确定要删除此AI代理吗？此操作将同时删除所有相关会话记录，且无法撤销。</p>
            <DialogFooter>
              <Button variant="outline" onClick={() => setDeleteDialogOpen(false)}>取消</Button>
              <Button variant="destructive" onClick={handleDeleteAgent}>确认删除</Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </MainLayout>
  );
};

export default AgentsPage; 