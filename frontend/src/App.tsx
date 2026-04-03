import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import axios from "axios";

// JD 匹配接口返回的数据结构，会直接映射到结果卡片中。
type MatchResult = {
  score?: number;
  matched?: string[];
  missing?: string[];
  suggestions?: string[];
};

type ChatRole = "user" | "assistant";

type ChatMessage = {
  id: string;
  role: ChatRole;
  content: string;
  createdAt: string;
};

type ChatSession = {
  id: string;
  title: string;
  createdAt: string;
  updatedAt: string;
  messages: ChatMessage[];
};

type ToastState = {
  tone: "success" | "error" | "info";
  message: string;
} | null;

// 记录当前哪一条 AI 消息正在做逐字显示。
type TypingState = {
  messageId: string;
  sessionId: string;
  visibleChars: number;
} | null;

const API_BASE_URL = "http://127.0.0.1:8000/api";
const CHAT_SESSIONS_STORAGE_KEY = "resume-chat-sessions";
const ACTIVE_SESSION_STORAGE_KEY = "resume-chat-active-session";
const DEFAULT_SESSION_TITLE = "新对话";
const QUICK_PROMPTS = [
  "这份简历适合投递什么岗位？",
  "这段项目经历怎样表达会更像面试回答？",
  "如果面试官追问项目难点，我应该怎么展开？",
  "这份简历目前最亮眼和最薄弱的地方分别是什么？",
];

function generateId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

// 每个聊天线程彼此独立，方便用户围绕同一份简历探索不同提问方向。
function createSession(title = DEFAULT_SESSION_TITLE): ChatSession {
  const now = new Date().toISOString();
  return {
    id: generateId("session"),
    title,
    createdAt: now,
    updatedAt: now,
    messages: [],
  };
}

function buildMessage(role: ChatRole, content: string): ChatMessage {
  return {
    id: generateId("message"),
    role,
    content,
    createdAt: new Date().toISOString(),
  };
}

// 后端偶尔会带一点 Markdown 痕迹，这里统一清洗成纯文本后再渲染。
function normalizeAssistantReply(text: string) {
  return text
    .replace(/^#{1,6}\s*/gm, "")
    .replace(/\*\*(.*?)\*\*/g, "$1")
    .replace(/\*(.*?)\*/g, "$1")
    .replace(/`([^`]+)`/g, "$1")
    .replace(/^\s*[-*+]\s+/gm, "• ")
    .trim();
}

function formatTime(dateText: string) {
  return new Date(dateText).toLocaleTimeString("zh-CN", {
    hour: "2-digit",
    minute: "2-digit",
  });
}

// 如果用户没有手动重命名，会把第一条问题裁剪成默认会话标题。
function buildSessionTitle(question: string) {
  const normalized = question.replace(/\s+/g, " ").trim();
  return normalized.length > 18 ? `${normalized.slice(0, 18)}...` : normalized;
}

// Hero 区会显示简历文本的大致规模，帮助判断解析是否真的成功拿到内容。
function formatResumeSize(text: string) {
  if (!text.trim()) {
    return "--";
  }

  const length = text.trim().length;
  return length >= 1000 ? `${(length / 1000).toFixed(1)}k 字` : `${length} 字`;
}

function App() {
  // 上传与解析相关状态。
  const [file, setFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  // 聊天工作台相关状态。
  const [question, setQuestion] = useState("");
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [sessionMenuId, setSessionMenuId] = useState("");
  const [qaLoading, setQaLoading] = useState(false);
  // JD 匹配分析相关状态。
  const [jdText, setJdText] = useState("");
  const [jdLoading, setJdLoading] = useState(false);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  // 页面级轻提示状态。
  const [toast, setToast] = useState<ToastState>(null);
  // 完整回答依旧存进 sessions，这里只负责控制“当前显示到第几个字”。
  const [typingState, setTypingState] = useState<TypingState>(null);
  const chatHistoryRef = useRef<HTMLDivElement | null>(null);
  // 搜索输入可以稍微延迟，不需要和其他交互抢响应。
  const deferredSearchKeyword = useDeferredValue(searchKeyword);

  // 常用派生状态，避免 JSX 里充满重复判断。
  const hasResume = resumeText.trim().length > 0;
  const activeSession =
    sessions.find((session) => session.id === activeSessionId) ?? sessions[0] ?? null;
  const chatMessages = activeSession?.messages ?? [];
  const filteredSessions = useMemo(() => {
    const keyword = deferredSearchKeyword.trim().toLowerCase();
    if (!keyword) {
      return sessions;
    }

    return sessions.filter((session) => {
      const lastMessage = session.messages[session.messages.length - 1]?.content ?? "";
      return `${session.title} ${lastMessage}`.toLowerCase().includes(keyword);
    });
  }, [deferredSearchKeyword, sessions]);

  // Hero 区统计信息：让用户一眼看到当前工作区的整体状态。
  const heroStats = [
    {
      label: "简历状态",
      value: hasResume ? "已解析" : loading ? "解析中" : "待上传",
    },
    {
      label: "对话轮次",
      value: `${chatMessages.length} 条消息`,
    },
    {
      label: "简历规模",
      value: formatResumeSize(resumeText),
    },
  ];

  // Hero 右侧的步骤条，对应产品希望用户遵循的使用流程。
  const workflowSteps = [
    {
      step: "01",
      title: "上传并解析简历",
      description: "先把简历内容变成可追问的上下文。",
      state: hasResume ? "done" : loading ? "active" : "idle",
    },
    {
      step: "02",
      title: "围绕简历连续追问",
      description: "像面试预演一样反复打磨亮点、缺口和表达。",
      state: hasResume ? "active" : "idle",
    },
    {
      step: "03",
      title: "拿 JD 做匹配分析",
      description: "把岗位要求、缺失项和优化建议拆清楚。",
      state: matchResult ? "done" : jdLoading ? "active" : "idle",
    },
  ] as const;

  // 从 localStorage 恢复会话历史，避免刷新后上下文丢失。
  useEffect(() => {
    try {
      const cachedSessions = localStorage.getItem(CHAT_SESSIONS_STORAGE_KEY);
      const cachedActiveSessionId = localStorage.getItem(ACTIVE_SESSION_STORAGE_KEY);

      if (cachedSessions) {
        const parsedSessions = JSON.parse(cachedSessions) as ChatSession[];
        if (parsedSessions.length > 0) {
          setSessions(parsedSessions);
          setActiveSessionId(
            cachedActiveSessionId && parsedSessions.some((item) => item.id === cachedActiveSessionId)
              ? cachedActiveSessionId
              : parsedSessions[0].id
          );
          return;
        }
      }
    } catch (error) {
      console.error("读取聊天记录失败:", error);
    }

    const initialSession = createSession();
    setSessions([initialSession]);
    setActiveSessionId(initialSession.id);
  }, []);

  // 每次会话发生有效变化后都立即持久化。
  useEffect(() => {
    if (sessions.length === 0) {
      return;
    }

    try {
      localStorage.setItem(CHAT_SESSIONS_STORAGE_KEY, JSON.stringify(sessions));
      localStorage.setItem(ACTIVE_SESSION_STORAGE_KEY, activeSessionId || sessions[0].id);
    } catch (error) {
      console.error("保存聊天记录失败:", error);
    }
  }, [activeSessionId, sessions]);

  // 无论是新消息进入，还是逐字显示推进，都自动把滚动条推到底部。
  // Toast 是轻提示，所以会自动消失，不阻断用户流程。
  useEffect(() => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  }, [activeSessionId, chatMessages, qaLoading, typingState?.visibleChars]);

  useEffect(() => {
    if (!toast) {
      return;
    }

    const timeoutId = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timeoutId);
  }, [toast]);

  // 通过逐步增加可见字符数，模拟“边生成边输出”的视觉效果。
  useEffect(() => {
    if (!typingState) {
      return;
    }

    const session = sessions.find((item) => item.id === typingState.sessionId);
    const targetMessage = session?.messages.find((item) => item.id === typingState.messageId);

    if (!targetMessage || targetMessage.role !== "assistant") {
      setTypingState(null);
      return;
    }

    if (typingState.visibleChars >= targetMessage.content.length) {
      setTypingState(null);
      return;
    }

    const remaining = targetMessage.content.length - typingState.visibleChars;
    const step = remaining > 120 ? 4 : remaining > 48 ? 3 : 2;
    const timeoutId = window.setTimeout(() => {
      setTypingState((current) =>
        current && current.messageId === targetMessage.id
          ? {
              ...current,
              visibleChars: Math.min(
                targetMessage.content.length,
                current.visibleChars + step
              ),
            }
          : current
      );
    }, 18);

    return () => window.clearTimeout(timeoutId);
  }, [sessions, typingState]);

  const showToast = (message: string, tone: NonNullable<ToastState>["tone"] = "info") => {
    setToast({ tone, message });
  };

  // 只有正在打字的那条消息需要裁切，其余消息直接完整显示。
  const getDisplayedMessageContent = (message: ChatMessage) => {
    if (
      typingState &&
      typingState.sessionId === activeSession?.id &&
      typingState.messageId === message.id
    ) {
      return message.content.slice(0, typingState.visibleChars);
    }

    return message.content;
  };

  // 给 JSX 用的辅助判断：只有当前那条消息需要附加闪烁光标样式。
  const isMessageTyping = (message: ChatMessage) =>
    typingState?.sessionId === activeSession?.id && typingState.messageId === message.id;

  // 会话更新逻辑集中在这里，避免每个按钮都各写一套数组改动代码。
  const updateSession = (sessionId: string, updater: (session: ChatSession) => ChatSession) => {
    setSessions((currentSessions) =>
      currentSessions.map((session) =>
        session.id === sessionId ? updater(session) : session
      )
    );
  };

  // 新建会话后插到顶部并自动切换过去，减少一次额外点击。
  const createNewSession = (title = DEFAULT_SESSION_TITLE) => {
    const nextSession = createSession(title);
    setSessions((currentSessions) => [nextSession, ...currentSessions]);
    setActiveSessionId(nextSession.id);
    setQuestion("");
    return nextSession;
  };

  // 会话列表保留极简视觉，但三个点菜单里仍然要能删除会话。
  const removeSession = (sessionId: string) => {
    setSessions((currentSessions) => {
      const filtered = currentSessions.filter((session) => session.id !== sessionId);

      if (filtered.length === 0) {
        const fallbackSession = createSession();
        setActiveSessionId(fallbackSession.id);
        setQuestion("");
        return [fallbackSession];
      }

      if (sessionId === activeSessionId) {
        setActiveSessionId(filtered[0].id);
      }

      return filtered;
    });

    setSessionMenuId("");
    showToast("会话已删除", "info");
  };

  // 上传新简历时要先清掉旧分析结果，避免不同简历的数据混在一起。
  const handleUpload = async () => {
    if (!file) {
      setUploadMessage("请先选择一份 PDF、DOCX 或 TXT 简历。");
      showToast("还没有选择简历文件", "error");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setLoading(true);
      setUploadMessage("");
      setResumeText("");
      setMatchResult(null);

      const res = await axios.post(`${API_BASE_URL}/resume/upload`, formData, {
        headers: {
          "Content-Type": "multipart/form-data",
        },
      });

      setResumeText(res.data.resumeText || "");
      setUploadMessage("简历解析完成，现在可以继续多轮提问或做 JD 匹配。");
      showToast("简历已成功导入", "success");

      if (!activeSession || activeSession.messages.length > 0) {
        createNewSession("简历新对话");
      }
    } catch (error: any) {
      console.error("上传失败:", error);
      const detail = error?.response?.data?.detail || error?.message || "未知错误";
      setUploadMessage(`上传或解析失败：${detail}`);
      showToast("简历解析失败，请检查文件格式或后端服务", "error");
    } finally {
      setLoading(false);
    }
  };

  // 聊天请求会带上最新问题和会话历史，保证模型拿到连续上下文。
  const handleAskQuestion = async () => {
    const nextQuestion = question.trim();

    if (!hasResume) {
      setUploadMessage("请先上传并解析简历，再开始对话。");
      showToast("聊天功能需要先导入简历", "error");
      return;
    }

    if (!nextQuestion || qaLoading) {
      return;
    }

    const ensuredSession = activeSession ?? createNewSession();
    const userMessage = buildMessage("user", nextQuestion);
    const nextMessages = [...ensuredSession.messages, userMessage];
    const nextTitle =
      ensuredSession.messages.length === 0 ? buildSessionTitle(nextQuestion) : ensuredSession.title;

    updateSession(ensuredSession.id, (session) => ({
      ...session,
      title: nextTitle,
      updatedAt: userMessage.createdAt,
      messages: nextMessages,
    }));

    setQuestion("");
    setQaLoading(true);

    try {
      const res = await axios.post(`${API_BASE_URL}/chat/ask`, {
        resumeText,
        question: nextQuestion,
        messages: nextMessages.map((message) => ({
          role: message.role,
          content: message.content,
        })),
      });

      const assistantMessage = buildMessage(
        "assistant",
        normalizeAssistantReply(res.data.answer || "暂时还没有生成回答，请再试一次。")
      );

      updateSession(ensuredSession.id, (session) => ({
        ...session,
        updatedAt: assistantMessage.createdAt,
        messages: [...session.messages, assistantMessage],
      }));
      // 完整回答先保存，再从 0 个字符开始逐步展示。
      setTypingState({
        messageId: assistantMessage.id,
        sessionId: ensuredSession.id,
        visibleChars: 0,
      });
    } catch (error: any) {
      console.error("问答失败:", error);
      const detail = error?.response?.data?.detail || error?.message || "未知错误";
      const errorMessage = buildMessage("assistant", `问答失败：${detail}`);

      updateSession(ensuredSession.id, (session) => ({
        ...session,
        updatedAt: errorMessage.createdAt,
        messages: [...session.messages, errorMessage],
      }));
      showToast("这次提问没有成功返回结果", "error");
    } finally {
      setQaLoading(false);
    }
  };

  // 清空时保留这个会话容器本身，只移除其中的消息。
  const clearCurrentSession = () => {
    if (!activeSession) {
      return;
    }

    updateSession(activeSession.id, (session) => ({
      ...session,
      title: DEFAULT_SESSION_TITLE,
      updatedAt: new Date().toISOString(),
      messages: [],
    }));
    setQuestion("");
    showToast("当前会话已清空", "success");
  };

  // 删除当前会话后，自动切到剩余会话中的一个，保证界面始终有焦点目标。
  // Enter 直接发送，Shift + Enter 继续保留换行能力。
  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleAskQuestion();
    }
  };

  // 快捷提问只有在简历上下文已存在时才真正有意义。
  const applyQuickPrompt = (prompt: string) => {
    if (!hasResume) {
      showToast("先上传简历，快捷提问才会更有意义", "info");
      return;
    }

    setQuestion(prompt);
  };

  // JD 匹配必须同时满足“已解析简历”和“已填写 JD”两个前提。
  const handleJDMatch = async () => {
    if (!hasResume) {
      setMatchResult({
        score: 0,
        matched: ["请先上传并解析简历。"],
        missing: ["当前还没有可用于分析的简历内容。"],
        suggestions: ["先导入简历，再开始做 JD 匹配分析。"],
      });
      showToast("JD 匹配需要先导入简历", "error");
      return;
    }

    if (!jdText.trim()) {
      setMatchResult({
        score: 0,
        matched: ["请先粘贴岗位 JD。"],
        missing: ["当前还没有岗位描述内容。"],
        suggestions: ["补充完整的职责、要求或关键词后再分析。"],
      });
      showToast("还没有填写岗位 JD", "error");
      return;
    }

    try {
      setJdLoading(true);
      setMatchResult(null);

      const res = await axios.post(`${API_BASE_URL}/jd/match`, {
        resumeText,
        jdText,
      });

      setMatchResult(res.data.result || null);
      showToast("JD 匹配结果已更新", "success");
    } catch (error: any) {
      console.error("JD 匹配失败:", error);
      const detail = error?.response?.data?.detail || error?.message || "未知错误";
      setMatchResult({
        score: 0,
        matched: ["请求失败。"],
        missing: ["后端服务或模型调用未成功完成。"],
        suggestions: [detail],
      });
      showToast("JD 匹配分析失败", "error");
    } finally {
      setJdLoading(false);
    }
  };

  // 复制反馈统一走 toast，避免再用 alert 打断当前操作。
  const copyText = async (text: string, successMessage: string) => {
    if (!navigator.clipboard) {
      showToast("当前环境不支持剪贴板复制", "error");
      return;
    }

    try {
      await navigator.clipboard.writeText(text);
      showToast(successMessage, "success");
    } catch {
      showToast("复制失败，请手动复制", "error");
    }
  };

  // 占位列表让结果卡片在首次分析前也保持完整的布局结构。
  const matchLists = {
    matched: matchResult?.matched || ["匹配项会显示在这里。"],
    missing: matchResult?.missing || ["缺失项会显示在这里。"],
    suggestions: matchResult?.suggestions || ["优化建议会显示在这里。"],
  };

  return (
    <div className="app-shell">
      <div className="bg-orb bg-orb-left"></div>
      <div className="bg-orb bg-orb-right"></div>
      <div className="bg-grid"></div>

      {toast && (
        <div className={`toast toast-${toast.tone}`} role="status" aria-live="polite">
          {toast.message}
        </div>
      )}

      {/* 顶部导航始终可见，因为上传、聊天、JD 是整个页面的三个固定锚点。 */}
      <header className="topbar">
        <div className="brand">
          <div className="brand-logo">谢郑</div>
          <div>
            <div className="brand-title">AI 简历对话工作台</div>
            <div className="brand-sub">先上传简历，再围绕内容追问，最后做 JD 匹配。</div>
          </div>
        </div>

        <nav className="nav-links">
          <a href="#upload">上传简历</a>
          <a href="#chat">对话打磨</a>
          <a href="#jd">JD 匹配</a>
        </nav>
      </header>

      <main className="main-container">
        {/* Hero 先交代产品定位和当前流程，再把用户引到下面的工作区。 */}
        <section className="hero-panel">
          <div className="hero-copy">
            <div className="hero-badge">面试准备与岗位匹配</div>
            <h1>把一份简历,变成一套可以连续打磨的求职对话 </h1>
            <p>
              这不是单次问答工具，而是一块围绕简历展开的工作台。你可以先导入内容，
              再反复追问亮点、项目表达、面试预演和岗位适配度，让整个过程更像真实准备，而不是零散提问。
            </p>

            <div className="hero-actions">
              <a href="#upload" className="primary-link-btn">
                先上传简历
              </a>
              <a href={hasResume ? "#chat" : "#upload"} className="ghost-link-btn">
                {hasResume ? "继续当前对话" : "查看操作流程"}
              </a>
            </div>

            <div className="hero-chip-row">
              <span className="hero-chip">多轮上下文追问</span>
              <span className="hero-chip">简历亮点提炼</span>
              <span className="hero-chip">JD 缺口分析</span>
            </div>
          </div>

          <div className="hero-side">
            <div className="workflow-card">
              <div className="workflow-head">
                <div className="workflow-label">当前流程</div>
                <div className="workflow-status">
                  {hasResume ? "已进入对话阶段" : loading ? "正在解析简历" : "从上传开始"}
                </div>
              </div>

              <div className="workflow-list">
                {workflowSteps.map((item) => (
                  <div key={item.step} className={`workflow-item workflow-${item.state}`}>
                    <div className="workflow-step">{item.step}</div>
                    <div>
                      <div className="workflow-title">{item.title}</div>
                      <div className="workflow-description">{item.description}</div>
                    </div>
                  </div>
                ))}
              </div>
            </div>

            <div className="hero-metrics">
              {heroStats.map((item) => (
                <div key={item.label} className="metric-card">
                  <div className="metric-label">{item.label}</div>
                  <div className="metric-value">{item.value}</div>
                </div>
              ))}
            </div>
          </div>
        </section>

        <section className="section-stack">
          {/* 上传区排在第一位，因为后面的聊天和 JD 分析都依赖已解析的简历文本。 */}
          <section className="card upload-card" id="upload">
            <div className="card-header">
              <div>
                <h2>第一步：上传简历</h2>
                <p>支持 PDF、DOCX、TXT。优先上传文字版 PDF，解析通常会更稳定。</p>
              </div>
              <span className={`tag ${hasResume ? "tag-success" : loading ? "tag-active" : "tag-wait"}`}>
                {hasResume ? "已完成" : loading ? "处理中" : "待开始"}
              </span>
            </div>

            <div className="upload-grid">
              <label className="file-picker">
                <span className="picker-kicker">选择文件</span>
                <span className="picker-title">{file ? file.name : "还没有选择简历文件"}</span>
                <span className="picker-meta">支持 PDF / DOCX / TXT</span>
                <input
                  type="file"
                  accept=".pdf,.docx,.txt"
                  hidden
                  onChange={(event) => {
                    if (event.target.files && event.target.files.length > 0) {
                      setFile(event.target.files[0]);
                      setUploadMessage("");
                    }
                  }}
                />
              </label>

              <div className="upload-summary">
                <div className="summary-item">
                  <span>当前状态</span>
                  <strong>{hasResume ? "简历内容已导入" : "等待上传"}</strong>
                </div>
                <div className="summary-item">
                  <span>建议动作</span>
                  <strong>{hasResume ? "继续去对话区提问" : "先选择文件并解析"}</strong>
                </div>
                <button
                  className="primary-btn primary-btn-wide"
                  onClick={handleUpload}
                  disabled={!file || loading}
                >
                  {loading ? "正在解析..." : hasResume ? "重新上传并解析" : "上传并解析"}
                </button>
              </div>
            </div>

            {uploadMessage && (
              <div
                className={`notice ${
                  uploadMessage.includes("完成") ? "notice-success" : "notice-error"
                }`}
              >
                {uploadMessage}
              </div>
            )}
          </section>

          {/* 聊天区是核心工作台，简历导入成功后用户大部分时间会停留在这里。 */}
          <section className="card chat-stage-card" id="chat">
            <div className="card-header">
              <div>
                <h2>第二步：围绕简历连续追问</h2>
              </div>
              <div className="chat-actions">
                <button
                  className="small-copy-btn"
                  onClick={() =>
                    copyText(
                      chatMessages
                        .map(
                          (item) =>
                            `${item.role === "user" ? "我" : "助手"} ${formatTime(
                              item.createdAt
                            )}\n${item.content}`
                        )
                        .join("\n\n"),
                      "聊天记录已复制"
                    )
                  }
                  disabled={chatMessages.length === 0}
                >
                  复制聊天
                </button>
                <button
                  className="small-copy-btn"
                  onClick={clearCurrentSession}
                  disabled={chatMessages.length === 0 || qaLoading}
                >
                  清空当前
                </button>
              </div>
            </div>

            {!hasResume && (
              <div className="notice notice-info">
                上传简历后，快捷问题、输入框和输入结果才会围绕真实内容展开。
              </div>
            )}

            <div className="chat-stage">
              {/* 左侧会话栏负责承载多线程提问，避免长对话互相覆盖。 */}
              <aside className="session-rail">
                <div className="session-rail-header">
                  <div className="session-rail-title">会话列表</div>
                  <div className="session-rail-sub">共 {sessions.length} 个会话</div>
                  <div className="session-search-wrap">
                    <input
                      className="session-search-input"
                      type="text"
                      placeholder="搜索会话标题或最近消息"
                      value={searchKeyword}
                      onChange={(event) => setSearchKeyword(event.target.value)}
                    />
                  </div>
                </div>

                <div className="session-list">
                  {filteredSessions.map((session) => {
                    return (
                      <div
                        key={session.id}
                        role="button"
                        tabIndex={0}
                        className={`session-item ${
                          session.id === activeSessionId ? "session-item-active" : ""
                        }`}
                        onClick={() => setActiveSessionId(session.id)}
                        onKeyDown={(event) => {
                          if (event.key === "Enter" || event.key === " ") {
                            event.preventDefault();
                            setActiveSessionId(session.id);
                          }
                        }}
                      >
                        <div className="session-item-top">
                          <div className="session-item-title">{session.title || DEFAULT_SESSION_TITLE}</div>
                          <div className="session-item-more">
                            <button
                              type="button"
                              className="session-item-more-btn"
                              title="会话操作"
                              aria-label="会话操作"
                              onClick={(event) => {
                                event.stopPropagation();
                                setSessionMenuId((current) =>
                                  current === session.id ? "" : session.id
                                );
                              }}
                            >
                              <span></span>
                              <span></span>
                              <span></span>
                            </button>

                            {sessionMenuId === session.id && (
                              <div className="session-item-menu">
                                <button
                                  type="button"
                                  className="session-item-menu-btn"
                                  onClick={(event) => {
                                    event.stopPropagation();
                                    removeSession(session.id);
                                  }}
                                >
                                  删除对话
                                </button>
                              </div>
                            )}
                          </div>
                        </div>
                      </div>
                    );
                  })}

                  {filteredSessions.length === 0 && (
                    <div className="session-empty">没有找到相关会话，换个关键词试试。</div>
                  )}
                </div>
              </aside>

              {/* 右侧主画布把提问建议、历史消息和输入区集中在同一列中。 */}
              <div className={`chat-canvas ${hasResume ? "" : "chat-canvas-compact"}`}>
                {hasResume && (
                  <div className="chat-intro-panel">
                    <div className="chat-hint-tag">推荐提问方向</div>
                    <div className="quick-prompt-list">
                      {QUICK_PROMPTS.map((prompt) => (
                        <button
                          key={prompt}
                          type="button"
                          className="quick-prompt-btn"
                          onClick={() => applyQuickPrompt(prompt)}
                          disabled={!hasResume}
                        >
                          {prompt}
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="chat-history-shell">
                  <div className="chat-history-topbar">
                    <div>
                      <div className="chat-history-title">
                        {activeSession?.title || DEFAULT_SESSION_TITLE}
                      </div>
                      <div className="chat-history-sub">
                        {hasResume ? "已加载简历上下文，可以连续追问。" : "等待简历内容导入。"}
                      </div>
                    </div>
                    <div className="chat-status-dot">
                      <span></span>
                      {hasResume ? "可继续提问" : "等待简历"}
                    </div>
                  </div>

                  <div className="chat-history" ref={chatHistoryRef}>
                    {chatMessages.length === 0 ? (
                      <div className="chat-empty">
                        <div className="chat-empty-title">从一条真实问题开始</div>
                        <div className="chat-empty-text">
                          例如“这份简历更适合投递什么岗位”或“这段项目该怎么讲才更像面试回答”。
                        </div>
                      </div>
                    ) : (
                      chatMessages.map((message) => (
                        <div
                          key={message.id}
                          className={`chat-bubble ${
                            message.role === "user" ? "chat-bubble-user" : "chat-bubble-ai"
                          }`}
                        >
                          {message.role === "assistant" && (
                            <div className="chat-bubble-head">
                              <div className="chat-bubble-role">AI 助手</div>
                              <div className="chat-bubble-time">{formatTime(message.createdAt)}</div>
                            </div>
                          )}
                          <div
                            className={`chat-bubble-content ${
                              message.role === "user" ? "chat-bubble-content-user" : ""
                            } ${
                              isMessageTyping(message) ? "chat-bubble-content-typing" : ""
                            }`}
                          >
                            {getDisplayedMessageContent(message)}
                          </div>
                        </div>
                      ))
                    )}

                    {qaLoading && (
                      <div className="chat-bubble chat-bubble-ai">
                        <div className="chat-bubble-head">
                          <div className="chat-bubble-role">AI 助手</div>
                          <div className="chat-bubble-time">正在思考</div>
                        </div>
                        <div className="typing-indicator">
                          <span></span>
                          <span></span>
                          <span></span>
                        </div>
                      </div>
                    )}
                  </div>

                  <div className="composer-panel">
                    <div className="composer-row">
                      <textarea
                        className="input-textarea chat-textarea composer-textarea"
                        rows={1}
                        placeholder={
                          hasResume
                            ? "输入你的问题，按 Enter 发送，Shift + Enter 换行。"
                            : "请先上传简历，聊天输入框会在导入后激活。"
                        }
                        value={question}
                        onChange={(event) => setQuestion(event.target.value)}
                        onKeyDown={handleKeyDown}
                        disabled={!hasResume || qaLoading}
                      />
                      <button
                        className="primary-btn composer-send-btn"
                        onClick={handleAskQuestion}
                        disabled={!hasResume || !question.trim() || qaLoading}
                      >
                        {qaLoading ? "生成中..." : "发送问题"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          {/* JD 匹配单独成区，让它更像一次明确的分析动作，而不是聊天附属能力。 */}
          <section className="card jd-card" id="jd">
            <div className="card-header">
              <div>
                <h2>第三步：做 JD 匹配分析</h2>
                <p>粘贴岗位描述后，快速查看匹配度、缺口项和下一步优化建议。</p>
              </div>
              <button
                className="small-copy-btn"
                onClick={() =>
                  copyText(JSON.stringify(matchResult, null, 2), "JD 匹配结果已复制")
                }
                disabled={!matchResult}
              >
                复制结果
              </button>
            </div>

            {!hasResume && (
              <div className="notice notice-info">
                你可以先准备 JD 文本，但正式分析需要先上传简历。
              </div>
            )}

            <div className="input-group">
              <textarea
                className="input-textarea jd-textarea"
                placeholder="把岗位职责、要求、加分项粘贴到这里。越完整，匹配结果越有参考价值。"
                value={jdText}
                onChange={(event) => setJdText(event.target.value)}
              />
              <button
                className="primary-btn full-btn"
                onClick={handleJDMatch}
                disabled={!hasResume || !jdText.trim() || jdLoading}
              >
                {jdLoading ? "分析中..." : "开始分析"}
              </button>
            </div>

            <div className="stats-grid">
              <div className="stat-card">
                <div className="stat-label">匹配度</div>
                <div className="stat-value">
                  {matchResult?.score !== undefined ? `${matchResult.score}` : "--"}
                </div>
              </div>
              <div className="stat-card">
                <div className="stat-label">命中项</div>
                <div className="stat-value small">{matchResult?.matched?.length ?? 0}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">待补足</div>
                <div className="stat-value small">{matchResult?.missing?.length ?? 0}</div>
              </div>
            </div>

            <div className="result-cards">
              <div className="mini-result-card">
                <div className="mini-title">匹配项</div>
                <ul>
                  {matchLists.matched.map((item, index) => (
                    <li key={`${item}-${index}`}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="mini-result-card">
                <div className="mini-title">缺失项</div>
                <ul>
                  {matchLists.missing.map((item, index) => (
                    <li key={`${item}-${index}`}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="mini-result-card">
                <div className="mini-title">优化建议</div>
                <ul>
                  {matchLists.suggestions.map((item, index) => (
                    <li key={`${item}-${index}`}>{item}</li>
                  ))}
                </ul>
              </div>
            </div>
          </section>
        </section>
      </main>
    </div>
  );
}

export default App;
