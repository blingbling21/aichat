import { redirect } from "next/navigation";

/**
 * 首页组件
 * 重定向到聊天界面
 */
export default function Home() {
  redirect('/chat');
}
