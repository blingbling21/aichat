const isProd = process.env.NODE_ENV === 'production';

const internalHost = process.env.TAURI_DEV_HOST || 'localhost';

/** @type {import('next').NextConfig} */
const nextConfig = {
  // Tauri应用需要静态文件，但在开发环境下禁用以支持客户端组件
  // 在生产环境保持export模式，以便Tauri可以使用静态文件
  output: isProd ? 'export' : undefined,
  // 禁用严格模式以减少重复渲染问题
  reactStrictMode: false,
  // Note: This feature is required to use the Next.js Image component in SSG mode.
  // See https://nextjs.org/docs/messages/export-image-api for different workarounds.
  images: {
    unoptimized: true,
  },
  // Configure assetPrefix or else the server won't properly resolve your assets.
  assetPrefix: isProd ? undefined : `http://${internalHost}:3000`,
};

export default nextConfig;