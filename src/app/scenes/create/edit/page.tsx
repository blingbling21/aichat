"use client";

import SceneEditPage from '../../[id]/edit/page';

/**
 * 创建场景的编辑页面
 * 创建一个无ID的场景编辑环境
 */
export default function CreateSceneEditPage() {
  // 将创建模式标记传递给SceneEditPage组件
  return <SceneEditPage isCreateMode={true} />;
} 