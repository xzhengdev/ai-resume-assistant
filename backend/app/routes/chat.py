from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.llm_service import ask_resume_question

router = APIRouter()


class ChatRequest(BaseModel):
    resumeText: str
    question: str


@router.post("/ask")
async def ask_question(data: ChatRequest):
    if not data.resumeText.strip():
        raise HTTPException(status_code=400, detail="简历内容不能为空")

    if not data.question.strip():
        raise HTTPException(status_code=400, detail="问题不能为空")

    try:
        answer = ask_resume_question(data.resumeText, data.question)
        return {
            "success": True,
            "answer": answer,
            "source": "llm"
        }
    except Exception as e:
        return {
            "success": True,
            "answer": f"""当前大模型问答失败，已返回兜底结果。

可能原因：
1. 简历内容过长
2. 模型接口超时
3. 平台限流或额度问题

这是一个本地模拟回答示例：
根据当前简历内容，你具备一定的软件开发基础，并有项目实践经历。
建议优先投递：
1. Python 开发
2. Java 后端开发
3. Web 开发
4. AI 应用开发相关岗位

原始错误信息：
{str(e)}
""",
            "source": "mock"
        }