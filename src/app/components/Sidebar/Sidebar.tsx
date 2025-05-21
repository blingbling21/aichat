"use client";

import { FC } from 'react';
import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { MessageSquare, Settings, Users, Layers } from 'lucide-react';
import { Card, CardContent } from "@/components/ui/card";
import { Button } from "@/components/ui/button";

/**
 * 侧边栏导航组件
 * 包含聊天、AI代理、场景和设置导航项
 */
const Sidebar: FC = () => {
  const pathname = usePathname();

  // 导航项列表
  const navItems = [
    {
      name: '聊天',
      path: '/chat',
      icon: <MessageSquare size={24} />
    },
    {
      name: 'AI代理',
      path: '/agents',
      icon: <Users size={24} />
    },
    {
      name: '场景',
      path: '/scenes',
      icon: <Layers size={24} />
    },
    {
      name: '设置',
      path: '/settings',
      icon: <Settings size={24} />
    }
  ];

  return (
    <Card className="w-64 h-screen bg-gray-100 dark:bg-gray-900 flex flex-col border-r border-gray-200 dark:border-gray-800 rounded-none">
      <CardContent className="p-4 flex flex-col h-full">
        <div className="text-xl font-bold mb-6 px-2">AI聊天助手</div>
        
        <nav className="flex-1">
          <ul className="space-y-2">
            {navItems.map((item) => (
              <li key={item.path}>
                <Button
                  asChild
                  variant={pathname === item.path || pathname.startsWith(item.path + '/') ? "default" : "ghost"}
                  className="w-full justify-start"
                >
                  <Link href={item.path} className="flex items-center gap-3">
                    {item.icon}
                    <span>{item.name}</span>
                  </Link>
                </Button>
              </li>
            ))}
          </ul>
        </nav>
        
        <div className="mt-auto text-sm text-gray-500 dark:text-gray-400 px-2">
          版本 v1.0.0
        </div>
      </CardContent>
    </Card>
  );
};

export default Sidebar; 