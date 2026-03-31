from typing import List, Literal, Optional

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel, Field

from app.services.llm_service import ask_resume_question

router = APIRouter()


class ChatMessage(BaseModel):
    role: Literal["user", "assistant"]
    content: str


class ChatRequest(BaseModel):
    resumeText: str
    question: Optional[str] = None
    messages: List[ChatMessage] = Field(default_factory=list)


@router.post("/ask")
async def ask_question(data: ChatRequest):
    if not data.resumeText.strip():
        raise HTTPException(status_code=400, detail="简历内容不能为空。")

    latest_user_message = next(
        (
            message.content.strip()
            for message in reversed(data.messages)
            if message.role == "user" and message.content.strip()
        ),
        (data.question or "").strip(),
    )

    if not latest_user_message:
        raise HTTPException(status_code=400, detail="问题不能为空。")

    try:
        answer = ask_resume_question(
            data.resumeText,
            latest_user_message,
            [message.model_dump() for message in data.messages],
        )
        return {
            "success": True,
            "answer": answer,
            "source": "llm",
        }
    except Exception as e:
        return {
            "success": True,
            "answer": f"""当前模型请求失败，已返回兜底提示。

可能原因：
1. 简历内容过长
2. 模型接口超时
3. 上游平台限流或暂时不可用

建议：
你可以继续围绕岗位匹配、项目亮点、面试表达或 JD 匹配进行提问。
如果这个问题反复出现，建议缩短简历文本，或检查后端模型配置。

原始错误：
{str(e)}
""",
            "source": "mock",
        }
