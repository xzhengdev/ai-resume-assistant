import { useState } from "react";
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

  const [question, setQuestion] = useState("");
  const [qaAnswer, setQaAnswer] = useState("");
  const [qaLoading, setQaLoading] = useState(false);

  const [jdText, setJdText] = useState("");
  const [jdLoading, setJdLoading] = useState(false);
  const [matchResult, setMatchResult] = useState<MatchResult | null>(null);

  const handleUpload = async () => {
    if (!file) {
      alert("请先选择简历文件");
      return;
    }

    const formData = new FormData();
    formData.append("file", file);

    try {
      setLoading(true);
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
      setQaAnswer("");
      setMatchResult(null);
    } catch (error) {
      console.error("上传失败:", error);
      alert("上传或解析失败，请检查后端是否启动");
    } finally {
      setLoading(false);
    }
  };

  const handleAskQuestion = async () => {
    if (!resumeText.trim()) {
      alert("请先上传并解析简历");
      return;
    }

    if (!question.trim()) {
      alert("请输入你的问题");
      return;
    }

    try {
      setQaLoading(true);

      const res = await axios.post("http://127.0.0.1:8000/api/chat/ask", {
        resumeText,
        question,
      });

      setQaAnswer(res.data.answer || "暂无回答");
    } catch (error) {
      console.error("问答失败:", error);
      setQaAnswer(
        "问答接口暂未连接成功。你可以先继续完善页面，后端 /api/chat/ask 接好后这里会正常显示 AI 回答。"
      );
    } finally {
      setQaLoading(false);
    }
  };

  const handleJDMatch = async () => {
    if (!resumeText.trim()) {
      alert("请先上传并解析简历");
      return;
    }

    if (!jdText.trim()) {
      alert("请输入岗位 JD");
      return;
    }

    try {
      setJdLoading(true);

      const res = await axios.post("http://127.0.0.1:8000/api/jd/match", {
        resumeText,
        jdText,
      });

      setMatchResult(res.data.result || null);
    } catch (error) {
      console.error("JD 分析失败:", error);
      setMatchResult({
        score: 0,
        matched: ["JD 匹配接口暂未连接成功"],
        missing: ["后端 /api/jd/match 还未接入"],
        suggestions: ["先把页面和交互做完整，后端接口完成后即可正常分析"],
      });
    } finally {
      setJdLoading(false);
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
          <div className="hero-badge">AI 求职工具 Demo</div>
          <h1>让简历分析、问答与岗位匹配更直观</h1>
          <p>
            上传简历后，可查看解析结果、发起简历问答，并基于岗位 JD
            进行匹配分析。这一版先把产品界面和核心链路搭起来。
          </p>
        </section>

        <section className="content-grid">
          <div className="left-panel">
            <div className="card" id="upload">
              <div className="card-header">
                <div>
                  <h2>上传简历</h2>
                  <p>支持 PDF / DOCX / TXT 格式</p>
                </div>
                <span className="tag">{resumeText ? "已解析" : "待上传"}</span>
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
            </div>

            <div className="card" id="qa">
              <div className="card-header">
                <div>
                  <h2>简历问答</h2>
                  <p>围绕简历内容进行智能问答</p>
                </div>
              </div>

              <div className="input-group">
                <textarea
                  className="input-textarea"
                  placeholder="例如：这份简历适合投什么岗位？有哪些亮点？"
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
                  {qaAnswer || "这里会展示基于简历内容生成的回答。"}
                </div>
              </div>
            </div>

            <div className="card" id="jd">
              <div className="card-header">
                <div>
                  <h2>JD 匹配分析</h2>
                  <p>输入岗位描述，分析简历匹配度与优化建议</p>
                </div>
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
                  <p>系统提取出的原始文本内容</p>
                </div>
                <span className="tag">{file ? "已载入文件" : "无文件"}</span>
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