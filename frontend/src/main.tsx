// StrictMode 会在开发阶段帮助我们提前发现副作用和不安全的写法。
import { StrictMode } from 'react'
// createRoot 是 React 18/19 推荐的现代挂载入口。
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

// 整个单页应用都会挂载到 index.html 里的 #root 节点上。
createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
