"use client";

import { FC } from 'react';
import { MainLayout } from '../components';
import ChatInterface from './ChatInterface';

/**
 * 聊天页面
 */
const ChatPage: FC = () => {
  return (
    <MainLayout>
      <ChatInterface />
    </MainLayout>
  );
};

export default ChatPage; 