// 这个项目的前端构建配置很简单：
// 只需要 React 插件加上 Vite 默认的开发/构建能力即可。
import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  // React 插件负责 JSX/TSX 转换以及开发时的热更新体验。
  plugins: [react()],
})
