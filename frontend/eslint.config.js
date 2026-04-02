// 使用 ESLint Flat Config，把前端的代码规范统一放在一个文件里维护。
import js from '@eslint/js'
import globals from 'globals'
import reactHooks from 'eslint-plugin-react-hooks'
import reactRefresh from 'eslint-plugin-react-refresh'
import tseslint from 'typescript-eslint'
import { defineConfig, globalIgnores } from 'eslint/config'

export default defineConfig([
  // 构建产物不参与 lint，避免无意义的检查噪音。
  globalIgnores(['dist']),
  {
    files: ['**/*.{ts,tsx}'],
    extends: [
      // 组合基础 JS 规则、TypeScript 安全规则，以及 React 相关检查。
      js.configs.recommended,
      tseslint.configs.recommended,
      reactHooks.configs.flat.recommended,
      reactRefresh.configs.vite,
    ],
    languageOptions: {
      // 项目运行在现代浏览器环境，ES2020 语法可以直接使用。
      ecmaVersion: 2020,
      // 声明浏览器全局变量，避免 window/document 等被误报。
      globals: globals.browser,
    },
  },
])
