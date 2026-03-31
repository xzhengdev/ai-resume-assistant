import { useEffect, useMemo, useRef, useState } from "react";
import type { KeyboardEvent } from "react";
import axios from "axios";
import "./index.css";

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

const API_BASE_URL = "http://127.0.0.1:8000/api";
const CHAT_SESSIONS_STORAGE_KEY = "resume-chat-sessions";
const ACTIVE_SESSION_STORAGE_KEY = "resume-chat-active-session";
const QUICK_PROMPTS = [
  "这份简历适合投什么岗位？",
  "这段项目经历怎么说更像面试表达？",
  "如果面试官追问项目难点，我该怎么回答？",
  "这份简历最大的亮点和短板分别是什么？",
];

function generateId(prefix: string) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
}

function createSession(title = "新对话"): ChatSession {
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

function formatSessionTime(dateText: string) {
  return new Date(dateText).toLocaleString("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  });
}

function buildSessionTitle(question: string) {
  const normalized = question.replace(/\s+/g, " ").trim();
  return normalized.length > 18 ? `${normalized.slice(0, 18)}...` : normalized;
}

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");
  const [question, setQuestion] = useState("");
  const [sessions, setSessions] = useState<ChatSession[]>([]);
  const [activeSessionId, setActiveSessionId] = useState("");
  const [searchKeyword, setSearchKeyword] = useState("");
  const [renamingSessionId, setRenamingSessionId] = useState("");
  const [renamingTitle, setRenamingTitle] = useState("");
  const [qaLoading, setQaLoading] = useState(false);
  const [jdText, setJdText] = useState("");
  const [jdLoading, setJdLoading] = useState(false);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);
  const chatHistoryRef = useRef<HTMLDivElement | null>(null);

  const hasResume = useMemo(() => resumeText.trim().length > 0, [resumeText]);
  const activeSession =
    sessions.find((session) => session.id === activeSessionId) ?? sessions[0] ?? null;
  const chatMessages = activeSession?.messages ?? [];
  const filteredSessions = useMemo(() => {
    const keyword = searchKeyword.trim().toLowerCase();
    if (!keyword) {
      return sessions;
    }

    return sessions.filter((session) => {
      const lastMessage = session.messages[session.messages.length - 1]?.content ?? "";
      return `${session.title} ${lastMessage}`.toLowerCase().includes(keyword);
    });
  }, [sessions, searchKeyword]);

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

      const initialSession = createSession();
      setSessions([initialSession]);
      setActiveSessionId(initialSession.id);
    } catch (error) {
      console.error("读取聊天记录失败:", error);
      const initialSession = createSession();
      setSessions([initialSession]);
      setActiveSessionId(initialSession.id);
    }
  }, []);

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
  }, [sessions, activeSessionId]);

  useEffect(() => {
    if (chatHistoryRef.current) {
      chatHistoryRef.current.scrollTop = chatHistoryRef.current.scrollHeight;
    }
  }, [chatMessages, qaLoading, activeSessionId]);

  const updateSession = (sessionId: string, updater: (session: ChatSession) => ChatSession) => {
    setSessions((currentSessions) =>
      currentSessions.map((session) =>
        session.id === sessionId ? updater(session) : session
      )
    );
  };

  const createNewSession = (title = "新对话") => {
    const nextSession = createSession(title);
    setSessions((currentSessions) => [nextSession, ...currentSessions]);
    setActiveSessionId(nextSession.id);
    setQuestion("");
    return nextSession;
  };

  const startRenameSession = (session: ChatSession) => {
    setRenamingSessionId(session.id);
    setRenamingTitle(session.title);
  };

  const submitRenameSession = (sessionId: string) => {
    const nextTitle = renamingTitle.trim();
    if (!nextTitle) {
      setRenamingSessionId("");
      setRenamingTitle("");
      return;
    }

    updateSession(sessionId, (session) => ({
      ...session,
      title: nextTitle,
      updatedAt: new Date().toISOString(),
    }));
    setRenamingSessionId("");
    setRenamingTitle("");
  };

  const handleUpload = async () => {
    if (!file) {
      setUploadMessage("请先选择简历文件。");
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
      setUploadMessage("简历解析成功，现在可以开始多轮聊天了。");

      if (!activeSession || activeSession.messages.length > 0) {
        createNewSession("简历新对话");
      }
    } catch (error: any) {
      console.error("上传失败:", error);
      const detail = error?.response?.data?.detail || error?.message || "未知错误";
      setUploadMessage(`上传或解析失败：${detail}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAskQuestion = async () => {
    const nextQuestion = question.trim();

    if (!resumeText.trim()) {
      setUploadMessage("请先上传并解析简历。");
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
        normalizeAssistantReply(res.data.answer || "暂无回答。")
      );

      updateSession(ensuredSession.id, (session) => ({
        ...session,
        updatedAt: assistantMessage.createdAt,
        messages: [...session.messages, assistantMessage],
      }));
    } catch (error: any) {
      console.error("问答失败:", error);
      const detail = error?.response?.data?.detail || error?.message || "未知错误";
      const errorMessage = buildMessage("assistant", `问答失败：${detail}`);

      updateSession(ensuredSession.id, (session) => ({
        ...session,
        updatedAt: errorMessage.createdAt,
        messages: [...session.messages, errorMessage],
      }));
    } finally {
      setQaLoading(false);
    }
  };

  const clearCurrentSession = () => {
    if (!activeSession) {
      return;
    }

    updateSession(activeSession.id, (session) => ({
      ...session,
      title: "新对话",
      updatedAt: new Date().toISOString(),
      messages: [],
    }));
    setQuestion("");
  };

  const removeSession = (sessionId: string) => {
    setSessions((currentSessions) => {
      const filtered = currentSessions.filter((session) => session.id !== sessionId);
      if (filtered.length === 0) {
        const nextSession = createSession();
        setActiveSessionId(nextSession.id);
        return [nextSession];
      }

      if (sessionId === activeSessionId) {
        setActiveSessionId(filtered[0].id);
      }

      return filtered;
    });
  };

  const handleKeyDown = (event: KeyboardEvent<HTMLTextAreaElement>) => {
    if (event.key === "Enter" && !event.shiftKey) {
      event.preventDefault();
      void handleAskQuestion();
    }
  };

  const applyQuickPrompt = (prompt: string) => {
    setQuestion(prompt);
  };

  const handleJDMatch = async () => {
    if (!resumeText.trim()) {
      setMatchResult({
        score: 0,
        matched: ["请先上传并解析简历。"],
        missing: ["当前还没有可用于分析的简历内容。"],
        suggestions: ["先上传简历，再开始进行 JD 匹配分析。"],
      });
      return;
    }

    if (!jdText.trim()) {
      setMatchResult({
        score: 0,
        matched: ["请先粘贴岗位 JD。"],
        missing: ["当前还没有岗位描述内容。"],
        suggestions: ["粘贴岗位 JD 后重新运行分析。"],
      });
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
    } catch (error: any) {
      console.error("JD 匹配失败:", error);
      const detail = error?.response?.data?.detail || error?.message || "未知错误";
      setMatchResult({
        score: 0,
        matched: ["请求失败。"],
        missing: ["后端或模型调用失败。"],
        suggestions: [detail],
      });
    } finally {
      setJdLoading(false);
    }
  };

  const copyText = async (text: string, successMessage: string) => {
    try {
      await navigator.clipboard.writeText(text);
      alert(successMessage);
    } catch {
      alert("复制失败，请手动复制。");
    }
  };

  return (
    <div className="app-shell">
      <div className="bg-orb bg-orb-left"></div>
      <div className="bg-orb bg-orb-right"></div>
      <div className="bg-grid"></div>

      <header className="topbar">
        <div className="brand">
          <div className="brand-logo">AI</div>
          <div>
            <div className="brand-title">AI 简历聊天助手</div>
            <div className="brand-sub">多轮对话 · 简历问答 · JD 匹配</div>
          </div>
        </div>

        <nav className="nav-links">
          <a href="#upload">上传简历</a>
          <a href="#chat">简历聊天</a>
          <a href="#jd">JD 匹配</a>
        </nav>
      </header>

      <main className="main-container">
        <section className="hero-panel">
          <div className="hero-copy">
            <div className="hero-badge">求职场景智能助手</div>
            <h1>让简历分析真正变成一场自然、持续、专业的对话</h1>
            <p>
              上传简历后，你可以像和 AI 助手聊天一样连续追问岗位匹配、项目表达、
              面试回答和简历优化建议，把工具感弱化，把体验做得更像产品。
            </p>
            <div className="hero-actions">
              <a href="#chat" className="primary-link-btn">
                立即开始聊天
              </a>
              <a href="#jd" className="ghost-link-btn">
                试试 JD 匹配
              </a>
            </div>
          </div>

          <div className="hero-metrics">
            <div className="metric-card">
              <div className="metric-label">聊天模式</div>
              <div className="metric-value">多会话</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">支持追问</div>
              <div className="metric-value">上下文记忆</div>
            </div>
            <div className="metric-card">
              <div className="metric-label">输出风格</div>
              <div className="metric-value">自然中文</div>
            </div>
          </div>
        </section>

        <section className="studio-layout">
          <section className="card upload-card" id="upload">
            <div className="card-header upload-header">
              <div>
                <h2>上传简历</h2>
                <p>支持 PDF、DOCX、TXT，建议优先上传文字版 PDF。</p>
              </div>
              <span className={`tag ${hasResume ? "tag-success" : "tag-wait"}`}>
                {hasResume ? "已就绪" : "待上传"}
              </span>
            </div>
            <div className="upload-area">
              <label className="primary-btn file-btn">
                选择文件
                <input
                  type="file"
                  accept=".pdf,.docx,.txt"
                  hidden
                  onChange={(e) => {
                    if (e.target.files && e.target.files.length > 0) {
                      setFile(e.target.files[0]);
                      setUploadMessage("");
                    }
                  }}
                />
              </label>
              <div className="file-display">{file ? file.name : "暂未选择文件"}</div>
              <button className="secondary-btn" onClick={handleUpload}>
                {loading ? "解析中..." : "上传并解析"}
              </button>
            </div>
            {uploadMessage && (
              <div
                className={`notice ${
                  uploadMessage.includes("成功") ? "notice-success" : "notice-error"
                }`}
              >
                {uploadMessage}
              </div>
            )}
          </section>

          <section className="card chat-stage-card" id="chat">
            <div className="card-header">
              <div>
                <h2>简历聊天</h2>
                <p>把简历问答做成真正的聊天工作台，主界面更聚焦，交互更完整。</p>
              </div>
              <div className="chat-actions">
                <button className="small-copy-btn" onClick={() => createNewSession()} disabled={qaLoading}>
                  新建对话
                </button>
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
                      "聊天记录已复制。"
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

            <div className="chat-stage">
              <aside className="session-rail">
                <div className="session-rail-header">
                  <div className="session-rail-title">会话列表</div>
                  <div className="session-rail-sub">共 {sessions.length} 个会话</div>
                  <div className="session-search-wrap">
                    <input
                      className="session-search-input"
                      type="text"
                      placeholder="搜索会话"
                      value={searchKeyword}
                      onChange={(e) => setSearchKeyword(e.target.value)}
                    />
                  </div>
                </div>

                <div className="session-list">
                  {filteredSessions.map((session) => {
                    const preview = session.messages[session.messages.length - 1]?.content;

                    return (
                      <div
                        key={session.id}
                        className={`session-item ${
                          session.id === activeSessionId ? "session-item-active" : ""
                        }`}
                        onClick={() => setActiveSessionId(session.id)}
                      >
                        <div className="session-item-top">
                          {renamingSessionId === session.id ? (
                            <input
                              className="session-rename-input"
                              value={renamingTitle}
                              autoFocus
                              onChange={(e) => setRenamingTitle(e.target.value)}
                              onClick={(event) => event.stopPropagation()}
                              onBlur={() => submitRenameSession(session.id)}
                              onKeyDown={(event) => {
                                if (event.key === "Enter") {
                                  event.preventDefault();
                                  submitRenameSession(session.id);
                                }
                                if (event.key === "Escape") {
                                  setRenamingSessionId("");
                                  setRenamingTitle("");
                                }
                              }}
                            />
                          ) : (
                            <div className="session-item-title">{session.title}</div>
                          )}

                          <div className="session-item-actions">
                            <button
                              type="button"
                              className="session-item-icon"
                              onClick={(event) => {
                                event.stopPropagation();
                                startRenameSession(session);
                              }}
                            >
                              改
                            </button>
                            <button
                              type="button"
                              className="session-item-icon"
                              onClick={(event) => {
                                event.stopPropagation();
                                removeSession(session.id);
                              }}
                            >
                              删
                            </button>
                          </div>
                        </div>
                        <div className="session-item-preview">
                          {preview || "还没有消息，开始你的第一轮提问。"}
                        </div>
                        <div className="session-item-time">{formatSessionTime(session.updatedAt)}</div>
                      </div>
                    );
                  })}

                  {filteredSessions.length === 0 && (
                    <div className="session-empty">没有找到相关会话</div>
                  )}
                </div>
              </aside>

              <div className="chat-canvas">
                <div className="chat-intro-panel">
                  <div className="chat-hint-tag">提问建议</div>
                  <p>
                    这份简历适合投什么岗位？这段项目经历怎么说更像面试表达？
                    面试官下一步最可能追问什么？
                  </p>
                  <div className="quick-prompt-list">
                    {QUICK_PROMPTS.map((prompt) => (
                      <button
                        key={prompt}
                        type="button"
                        className="quick-prompt-btn"
                        onClick={() => applyQuickPrompt(prompt)}
                      >
                        {prompt}
                      </button>
                    ))}
                  </div>
                </div>

                <div className="chat-history-shell">
                  <div className="chat-history-topbar">
                    <div>
                      <div className="chat-history-title">{activeSession?.title || "新对话"}</div>
                      <div className="chat-history-sub">已围绕简历内容开启上下文连续对话</div>
                    </div>
                    <div className="chat-status-dot">
                      <span></span>
                      AI 在线
                    </div>
                  </div>

                  <div className="chat-history" ref={chatHistoryRef}>
                    {chatMessages.length === 0 ? (
                      <div className="chat-empty">
                        <div className="chat-empty-title">开始一段新的求职对话</div>
                        <div className="chat-empty-text">
                          上传简历后，可以围绕岗位匹配、项目亮点、面试表达和简历优化持续追问。
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
                          <div className="chat-bubble-head">
                            <div className="chat-bubble-role">
                              {message.role === "user" ? "我" : "AI 助手"}
                            </div>
                            <div className="chat-bubble-time">{formatTime(message.createdAt)}</div>
                          </div>
                          <div className="chat-bubble-content">{message.content}</div>
                        </div>
                      ))
                    )}

                    {qaLoading && (
                      <div className="chat-bubble chat-bubble-ai">
                        <div className="chat-bubble-head">
                          <div className="chat-bubble-role">AI 助手</div>
                          <div className="chat-bubble-time">输入中</div>
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
                    <textarea
                      className="input-textarea chat-textarea"
                      placeholder="输入你的问题，按 Enter 发送，Shift + Enter 换行。"
                      value={question}
                      onChange={(e) => setQuestion(e.target.value)}
                      onKeyDown={handleKeyDown}
                    />
                    <div className="composer-footer">
                      <div className="composer-tip">
                        当前会话：
                        <span>{activeSession?.title || "新对话"}</span>
                      </div>
                      <button className="primary-btn composer-send-btn" onClick={handleAskQuestion}>
                        {qaLoading ? "生成中..." : "发送"}
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </section>

          <section className="card jd-card" id="jd">
            <div className="card-header">
              <div>
                <h2>JD 匹配分析</h2>
                <p>粘贴岗位描述，快速查看匹配度、缺失项和优化建议。</p>
              </div>
              <button
                className="small-copy-btn"
                onClick={() =>
                  copyText(JSON.stringify(matchResult, null, 2), "JD 匹配结果已复制。")
                }
                disabled={!matchResult}
              >
                复制结果
              </button>
            </div>
            <div className="input-group">
              <textarea
                className="input-textarea jd-textarea"
                placeholder="请在这里粘贴岗位 JD。"
                value={jdText}
                onChange={(e) => setJdText(e.target.value)}
              />
              <button className="primary-btn full-btn" onClick={handleJDMatch}>
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
                <div className="stat-label">匹配项</div>
                <div className="stat-value small">{matchResult?.matched?.length ?? 0}</div>
              </div>
              <div className="stat-card">
                <div className="stat-label">缺失项</div>
                <div className="stat-value small">{matchResult?.missing?.length ?? 0}</div>
              </div>
            </div>
            <div className="result-cards">
              <div className="mini-result-card">
                <div className="mini-title">匹配项</div>
                <ul>
                  {(matchResult?.matched || ["分析结果会显示在这里。"]).map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="mini-result-card">
                <div className="mini-title">缺失项</div>
                <ul>
                  {(matchResult?.missing || ["分析结果会显示在这里。"]).map((item, index) => (
                    <li key={index}>{item}</li>
                  ))}
                </ul>
              </div>
              <div className="mini-result-card">
                <div className="mini-title">优化建议</div>
                <ul>
                  {(matchResult?.suggestions || ["分析结果会显示在这里。"]).map(
                    (item, index) => (
                      <li key={index}>{item}</li>
                    )
                  )}
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
