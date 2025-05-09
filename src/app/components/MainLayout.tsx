import { FC, ReactNode } from 'react';
import Sidebar from './Sidebar/Sidebar';

/**
 * 主布局组件
 * 用于统一管理侧边栏和内容区域的布局
 */
interface MainLayoutProps {
  children: ReactNode;
}

const MainLayout: FC<MainLayoutProps> = ({ children }) => {
  return (
    <>
      <Sidebar />
      <div className="flex-1 h-screen overflow-auto">
        {children}
      </div>
    </>
  );
};

export default MainLayout; 