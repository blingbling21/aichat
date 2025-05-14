import React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import 'highlight.js/styles/github.css';
import { cn } from '@/lib/utils';
import { type Components } from 'react-markdown';

interface MarkdownProps {
  content: string;
  className?: string;
}

/**
 * Markdown渲染组件
 * 
 * 支持GitHub风格的Markdown和代码高亮
 * 
 * @param {string} content - Markdown内容
 * @param {string} className - 自定义CSS类名
 * @returns {React.ReactElement} 渲染后的Markdown内容
 */
export function Markdown({ content, className }: MarkdownProps) {
  const components: Components = {
    // 自定义代码块样式
    // @ts-expect-error - ReactMarkdown类型定义与实际不匹配
    code: ({ className, children, inline, ...props }) => {
      const language = /language-(\w+)/.exec(className || '');
      // 将language用作key值，避免警告
      const key = language ? language[1] : 'text';
      return !inline ? (
        <div className="not-prose relative" key={key}>
          <pre className={cn("rounded-md p-4 my-2 bg-slate-900 dark:bg-slate-800 overflow-x-auto", className)}>
            <code className={cn("text-sm font-mono", className)} {...props}>
              {children}
            </code>
          </pre>
        </div>
      ) : (
        <code className="px-1 py-0.5 rounded-sm bg-muted font-mono text-sm" {...props}>
          {children}
        </code>
      );
    },
    // 自定义表格样式
    table: ({ children }) => {
      return (
        <div className="overflow-x-auto">
          <table className="border-collapse table-auto w-full text-sm">
            {children}
          </table>
        </div>
      );
    },
    // 自定义链接样式
    a: ({ children, href }) => {
      return (
        <a 
          href={href} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-500 hover:text-blue-700 transition-colors"
        >
          {children}
        </a>
      );
    },
  };

  return (
    <div className={cn("prose prose-slate dark:prose-invert max-w-none", className)}>
      <ReactMarkdown
        remarkPlugins={[remarkGfm]} // 支持GitHub风格的Markdown
        rehypePlugins={[rehypeHighlight]} // 代码高亮
        components={components}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
} 