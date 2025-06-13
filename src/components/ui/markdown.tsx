import React from 'react';
import ReactMarkdown from 'react-markdown';
import rehypeHighlight from 'rehype-highlight';
import remarkGfm from 'remark-gfm';
import 'highlight.js/styles/atom-one-light.css';
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
      return !inline ? (
        <pre className={cn(
          "not-prose relative",
          "rounded-lg p-4 my-3 border overflow-x-auto",
          "bg-gray-50 border-gray-200 text-gray-900", // 亮色模式
          "dark:bg-gray-900 dark:border-gray-700 dark:text-gray-100", // 暗色模式
          "font-mono text-sm leading-relaxed"
        )} style={{
          // 强制覆盖highlight.js的颜色
          color: 'inherit'
        }}>
          <code className={cn(
            "block w-full",
            "text-gray-900 dark:text-gray-100", // 确保文字颜色
            className
          )} style={{
            color: 'inherit',
            background: 'transparent'
          }} {...props}>
            {children}
          </code>
        </pre>
      ) : (
        <code className={cn(
          "px-2 py-1 rounded text-sm font-mono",
          "bg-gray-100 text-gray-900",
          "dark:bg-gray-800 dark:text-gray-100"
        )} {...props}>
          {children}
        </code>
      );
    },
    // 自定义表格样式
    table: ({ children }) => {
      return (
        <div className="overflow-x-auto my-4">
          <table className="border-collapse table-auto w-full text-sm border border-gray-200 dark:border-gray-700">
            {children}
          </table>
        </div>
      );
    },
    // 自定义表头样式
    thead: ({ children }) => {
      return (
        <thead className="bg-gray-50 dark:bg-gray-800">
          {children}
        </thead>
      );
    },
    // 自定义表格单元格样式
    th: ({ children }) => {
      return (
        <th className="border border-gray-200 dark:border-gray-700 px-4 py-2 text-left font-semibold text-gray-900 dark:text-gray-100">
          {children}
        </th>
      );
    },
    td: ({ children }) => {
      return (
        <td className="border border-gray-200 dark:border-gray-700 px-4 py-2 text-gray-700 dark:text-gray-300">
          {children}
        </td>
      );
    },
    // 自定义链接样式
    a: ({ children, href }) => {
      return (
        <a 
          href={href} 
          target="_blank" 
          rel="noopener noreferrer"
          className="text-blue-500 hover:text-blue-700 transition-colors underline"
        >
          {children}
        </a>
      );
    },
    // 自定义标题样式
    h1: ({ children }) => (
      <h1 className="text-2xl font-bold text-gray-900 dark:text-gray-100 mt-6 mb-4 border-b border-gray-200 dark:border-gray-700 pb-2">
        {children}
      </h1>
    ),
    h2: ({ children }) => (
      <h2 className="text-xl font-bold text-gray-900 dark:text-gray-100 mt-5 mb-3">
        {children}
      </h2>
    ),
    h3: ({ children }) => (
      <h3 className="text-lg font-semibold text-gray-900 dark:text-gray-100 mt-4 mb-2">
        {children}
      </h3>
    ),
    h4: ({ children }) => (
      <h4 className="text-base font-semibold text-gray-900 dark:text-gray-100 mt-3 mb-2">
        {children}
      </h4>
    ),
    // 自定义段落样式
    p: ({ children }) => (
      <p className="text-gray-700 dark:text-gray-300 leading-relaxed mb-3">
        {children}
      </p>
    ),
    // 自定义列表样式
    ul: ({ children }) => (
      <ul className="list-disc list-inside text-gray-700 dark:text-gray-300 mb-3 ml-4">
        {children}
      </ul>
    ),
    ol: ({ children }) => (
      <ol className="list-decimal list-inside text-gray-700 dark:text-gray-300 mb-3 ml-4">
        {children}
      </ol>
    ),
    li: ({ children }) => (
      <li className="mb-1">
        {children}
      </li>
    ),
    // 自定义引用样式
    blockquote: ({ children }) => (
      <blockquote className="border-l-4 border-gray-300 dark:border-gray-600 pl-4 my-4 italic text-gray-600 dark:text-gray-400">
        {children}
      </blockquote>
    ),
    // 自定义强调样式
    strong: ({ children }) => (
      <strong className="font-bold text-gray-900 dark:text-gray-100">
        {children}
      </strong>
    ),
    em: ({ children }) => (
      <em className="italic text-gray-800 dark:text-gray-200">
        {children}
      </em>
    ),
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