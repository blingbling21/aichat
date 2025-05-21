import { redirect } from 'next/navigation';

/**
 * 创建场景页面
 * 重定向到场景编辑页面
 */
export default function CreateScenePage() {
  redirect('/scenes/create/edit');
} 