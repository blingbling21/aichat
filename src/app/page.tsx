import { MainLayout } from './components';
import ChatInterface from './chat/ChatInterface';

/**
 * 首页组件
 * 默认显示聊天界面
 */
export default function Home() {
  return (
    <MainLayout>
      <ChatInterface />
    </MainLayout>
  );
}
