# AI Resume Assistant

一个面向求职场景的 AI 简历对话工作台。

用户可以上传简历文件，系统会先解析出简历文本，再基于简历内容进行多轮问答，并结合岗位 JD 输出匹配度、缺失项和优化建议。

## 项目特点

- 支持 `PDF`、`DOCX`、`TXT` 简历上传与解析
- 支持围绕简历内容的多轮对话
- 支持会话列表、本地历史缓存和会话重命名
- 支持 JD 匹配分析，输出结构化结果
- 前端带有 AI 回复逐字显示效果
- 后端对 DOCX 做了额外兼容，能处理部分文本框模板简历

## 功能预览

当前版本的核心流程是：

1. 上传并解析简历
2. 围绕简历内容连续提问
3. 粘贴岗位 JD，查看匹配分析结果

前端已经包含：

- 上传引导和状态提示
- 多会话聊天工作台
- 快捷提问入口
- Toast 轻提示
- JD 匹配结果卡片

## 技术栈

### 前端

- React 19
- TypeScript
- Vite
- Axios
- 原生 CSS

### 后端

- FastAPI
- Pydantic
- Uvicorn
- OpenAI Python SDK
- pdfplumber
- python-docx
- python-dotenv

## 项目结构

```text
ai-resume-assistant/
├─ frontend/
│  ├─ src/
│  │  ├─ App.tsx
│  │  ├─ App.css
│  │  ├─ index.css
│  │  └─ main.tsx
│  ├─ package.json
│  └─ vite.config.ts
├─ backend/
│  ├─ app/
│  │  ├─ main.py
│  │  ├─ routes/
│  │  │  ├─ resume.py
│  │  │  ├─ chat.py
│  │  │  └─ jd.py
│  │  └─ services/
│  │     ├─ file_parser.py
│  │     ├─ llm_service.py
│  │     └─ prompt_builder.py
│  ├─ requirements.txt
│  └─ .env
└─ docs/
   └─ project-development-design.md
```

## 本地运行

### 1. 克隆项目

```bash
git clone https://github.com/22-python/ai-resume-assistant.git
cd ai-resume-assistant
```

### 2. 启动后端

进入后端目录并安装依赖：

```bash
cd backend
python -m venv venv
venv\Scripts\activate
pip install -r requirements.txt
```

创建 `backend/.env` 文件：

```env
API_KEY=your_api_key
BASE_URL=your_model_base_url
MODEL_NAME=your_model_name
```

启动后端服务：

```bash
uvicorn app.main:app --reload
```

默认地址：

- 后端接口：`http://127.0.0.1:8000`
- 接口文档：`http://127.0.0.1:8000/docs`

### 3. 启动前端

打开新的终端，进入前端目录：

```bash
cd frontend
npm install
npm run dev
```

默认地址：

- 前端页面：`http://127.0.0.1:5173`

## 接口概览

### `POST /api/resume/upload`

上传简历文件并返回解析后的纯文本。

请求类型：

- `multipart/form-data`

请求字段：

- `file`: 简历文件

### `POST /api/chat/ask`

基于简历内容进行问答，支持携带历史消息。

请求示例：

```json
{
  "resumeText": "简历内容",
  "question": "这份简历适合哪些岗位？",
  "messages": [
    {
      "role": "user",
      "content": "这份简历适合哪些岗位？"
    }
  ]
}
```

### `POST /api/jd/match`

根据简历内容和岗位 JD 生成结构化匹配分析。

请求示例：

```json
{
  "resumeText": "简历内容",
  "jdText": "岗位描述内容"
}
```

## 当前已实现的工程能力

- 前后端分离架构
- 基础路由拆分
- 文件解析服务抽离
- Prompt 构造与模型调用分层
- DOCX 解析兜底方案
- 前端本地会话持久化
- 基础异常提示与兜底结果

## 已知限制

- 当前没有用户系统
- 当前没有数据库
- 简历内容主要保存在前端内存和浏览器本地
- 模型问答仍为一次性返回，不是真正流式输出
- 扫描版 PDF 可能无法稳定提取文本
- JD 分析依赖模型输出 JSON，格式稳定性还有继续增强空间

## 后续优化方向

- 增加统一响应格式和错误码
- 增加全局异常处理和请求日志
- 增加前端组件拆分和 hooks 抽离
- 增加上传大小限制与安全校验
- 增加真实流式输出
- 增加测试用例和稳定性监控

## 开发文档

项目的前期开发设计文档已整理在：

- [docs/project-development-design.md](./docs/project-development-design.md)

文档中包含：

- 架构设计
- 模块拆分
- 接口设计
- 异常处理
- 性能与稳定性建议
- 测试与部署建议

## 适用场景

- 课程设计
- 校招求职辅助工具
- 个人全栈项目作品
- 大模型应用原型展示

