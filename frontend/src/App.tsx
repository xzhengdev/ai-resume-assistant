import { useMemo, useState } from "react";
import axios from "axios";
import "./index.css";

type MatchResult = {
  score?: number;
  matched?: string[];
  missing?: string[];
  suggestions?: string[];
};

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [resumeText, setResumeText] = useState("");
  const [loading, setLoading] = useState(false);
  const [uploadMessage, setUploadMessage] = useState("");

  const [question, setQuestion] = useState("");
  const [qaAnswer, setQaAnswer] = useState("");
  const [qaLoading, setQaLoading] = useState(false);

  const [jdText, setJdText] = useState("");
  const [jdLoading, setJdLoading] = useState(false);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);

  const hasResume = useMemo(() => resumeText.trim().length > 0, [resumeText]);

  const handleUpload = async () => {
    if (!file) {
      setUploadMessage("请先选择简历文件");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setLoading(true);
      setUploadMessage("");
      setResumeText("");
      setQaAnswer("");
      setMatchResult(null);

      const res = await axios.post(
        "http://127.0.0.1:8000/api/resume/upload",
        formData,
        {
          headers: {
            "Content-Type": "multipart/form-data",
          },
        }
      );

      setResumeText(res.data.resumeText || "");
      setUploadMessage("简历解析成功，可以开始问答和 JD 匹配分析了");
    } catch (error: any) {
      console.error("上传失败：", error);
      const detail =
        error?.response?.data?.detail || error?.message || "未知错误";
      setUploadMessage(`上传或解析失败：${detail}`);
    } finally {
      setLoading(false);
    }
  };

  const handleAskQuestion = async () => {
    if (!resumeText.trim()) {
      setQaAnswer("请先上传并解析简历");
      return;
    }

    if (!question.trim()) {
      setQaAnswer("请输入你的问题");
      return;
    }

    try {
      setQaLoading(true);
      setQaAnswer("");

      const res = await axios.post("http://127.0.0.1:8000/api/chat/ask", {
        resumeText,
        question,
      });

      setQaAnswer(res.data.answer || "暂无回答");
    } catch (error: any) {
      console.error("问答失败：", error);
      const detail =
        error?.response?.data?.detail || error?.message || "未知错误";
      setQaAnswer(`问答失败：${detail}`);
    } finally {
      setQaLoading(false);
    }
  };

  const handleJDMatch = async () => {
    if (!resumeText.trim()) {
      setMatchResult({
        score: 0,
        matched: ["请先上传并解析简历"],
        missing: ["当前没有可用于分析的简历内容"],
        suggestions: ["先上传简历，再进行岗位匹配分析"],
      });
      return;
    }

    if (!jdText.trim()) {
      setMatchResult({
        score: 0,
        matched: ["请输入岗位 JD"],
        missing: ["当前没有岗位描述内容"],
        suggestions: ["粘贴岗位要求后再开始分析"],
      });
      return;
    }

    try {
      setJdLoading(true);
      setMatchResult(null);

      const res = await axios.post("http://127.0.0.1:8000/api/jd/match", {
        resumeText,
        jdText,
      });

      setMatchResult(res.data.result || null);
    } catch (error: any) {
      console.error("JD 分析失败：", error);
      const detail =
        error?.response?.data?.detail || error?.message || "未知错误";

      setMatchResult({
        score: 0,
        matched: ["请求失败"],
        missing: ["后端或模型服务调用异常"],
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
      alert("复制失败，请手动复制");
    }
  };

  return (
    <div className="app-shell">
      <div className="bg-glow bg-glow-1"></div>
      <div className="bg-glow bg-glow-2"></div>

      <header className="topbar">
        <div className="brand">
          <div className="brand-logo">AI</div>
          <div>
            <div className="brand-title">AI 简历问答助手</div>
            <div className="brand-sub">Resume Analyzer · Q&A · JD Match</div>
          </div>
        </div>

        <nav className="nav-links">
          <a href="#upload">简历解析</a>
          <a href="#qa">简历问答</a>
          <a href="#jd">JD 匹配</a>
        </nav>
      </header>

      <main className="main-container">
        <section className="hero-panel">
          <div className="hero-badge">AI 求职场景项目 Demo</div>
          <h1>把简历解析、智能问答和岗位匹配做成真正可展示的产品</h1>
          <p>
            上传简历后，你可以快速查看解析结果、发起 AI
            问答，并基于岗位 JD 获取匹配度、缺失项和优化建议。
          </p>

          <div className="hero-actions">
            <a href="#upload" className="primary-link-btn">
              立即体验
            </a>
            <a href="#jd" className="ghost-link-btn">
              查看 JD 匹配
            </a>
          </div>
        </section>

        <section className="content-grid">
          <div className="left-panel">
            <div className="card" id="upload">
              <div className="card-header">
                <div>
                  <h2>上传简历</h2>
                  <p>支持 PDF / DOCX / TXT 格式，建议优先上传文本型 PDF</p>
                </div>
                <span className={`tag ${hasResume ? "tag-success" : "tag-wait"}`}>
                  {hasResume ? "已解析" : "待上传"}
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

                <div className="file-display">
                  {file ? file.name : "暂未选择文件"}
                </div>

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
            </div>

            <div className="card" id="qa">
              <div className="card-header">
                <div>
                  <h2>简历问答</h2>
                  <p>围绕简历内容提出问题，获取更贴近求职场景的回答</p>
                </div>
                <button
                  className="small-copy-btn"
                  onClick={() => copyText(qaAnswer || "", "已复制问答结果")}
                  disabled={!qaAnswer}
                >
                  复制结果
                </button>
              </div>

              <div className="input-group">
                <textarea
                  className="input-textarea"
                  placeholder="例如：这份简历适合投什么岗位？有哪些亮点？还缺哪些能力？"
                  value={question}
                  onChange={(e) => setQuestion(e.target.value)}
                />
                <button className="primary-btn full-btn" onClick={handleAskQuestion}>
                  {qaLoading ? "思考中..." : "开始问答"}
                </button>
              </div>

              <div className="answer-card">
                <div className="mini-title">AI 回答</div>
                <div className="answer-content">
                  {qaLoading
                    ? "正在分析你的简历内容，请稍等..."
                    : qaAnswer || "这里会展示基于简历内容生成的回答。"}
                </div>
              </div>
            </div>

            <div className="card" id="jd">
              <div className="card-header">
                <div>
                  <h2>JD 匹配分析</h2>
                  <p>输入岗位描述，分析简历匹配度、缺失项与优化建议</p>
                </div>
                <button
                  className="small-copy-btn"
                  onClick={() =>
                    copyText(
                      JSON.stringify(matchResult, null, 2),
                      "已复制 JD 匹配结果"
                    )
                  }
                  disabled={!matchResult}
                >
                  复制结果
                </button>
              </div>

              <div className="input-group">
                <textarea
                  className="input-textarea jd-textarea"
                  placeholder="请粘贴岗位 JD，例如岗位要求、技能栈、项目经验要求等..."
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
                  <div className="stat-value small">
                    {matchResult?.matched?.length ?? 0}
                  </div>
                </div>
                <div className="stat-card">
                  <div className="stat-label">缺失项</div>
                  <div className="stat-value small">
                    {matchResult?.missing?.length ?? 0}
                  </div>
                </div>
              </div>

              <div className="result-cards">
                <div className="mini-result-card">
                  <div className="mini-title">匹配项</div>
                  <ul>
                    {(matchResult?.matched || ["分析结果会显示在这里"]).map(
                      (item, index) => (
                        <li key={index}>{item}</li>
                      )
                    )}
                  </ul>
                </div>

                <div className="mini-result-card">
                  <div className="mini-title">缺失项</div>
                  <ul>
                    {(matchResult?.missing || ["分析结果会显示在这里"]).map(
                      (item, index) => (
                        <li key={index}>{item}</li>
                      )
                    )}
                  </ul>
                </div>

                <div className="mini-result-card">
                  <div className="mini-title">优化建议</div>
                  <ul>
                    {(matchResult?.suggestions || ["分析结果会显示在这里"]).map(
                      (item, index) => (
                        <li key={index}>{item}</li>
                      )
                    )}
                  </ul>
                </div>
              </div>
            </div>
          </div>

          <div className="right-panel">
            <div className="card sticky-card">
              <div className="card-header">
                <div>
                  <h2>简历解析结果</h2>
                  <p>系统提取出的原始文本内容，可作为问答与匹配分析的上下文</p>
                </div>
                <button
                  className="small-copy-btn"
                  onClick={() => copyText(resumeText, "已复制简历解析结果")}
                  disabled={!resumeText}
                >
                  复制文本
                </button>
              </div>

              <textarea
                className="resume-preview"
                value={resumeText}
                readOnly
                placeholder="上传简历后，解析结果会显示在这里..."
              />
            </div>
          </div>
        </section>
      </main>
    </div>
  );
}

export default App;