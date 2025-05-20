"use client";

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';

/**
 * 首页组件
 * 重定向到聊天界面
 */
export default function Home() {
  const router = useRouter();
  
  useEffect(() => {
    router.replace('/chat');
  }, [router]);
  
  return (
    <div className="flex items-center justify-center h-screen">
      <p className="text-gray-500">正在跳转到聊天页面...</p>
    </div>
  );
}
