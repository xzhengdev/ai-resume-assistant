"""JD 匹配分析接口。"""

import json

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

from app.services.llm_service import analyze_jd_match

router = APIRouter()


class JDMatchRequest(BaseModel):
    """简历与岗位描述匹配分析请求体。"""

    resumeText: str
    jdText: str


@router.post("/match")
async def match_jd(data: JDMatchRequest):
    """返回结构化的简历与 JD 匹配结果。"""
    if not data.resumeText.strip():
        raise HTTPException(status_code=400, detail="简历内容不能为空。")

    if not data.jdText.strip():
        raise HTTPException(status_code=400, detail="JD 内容不能为空。")

    try:
        # 模型被要求直接输出 JSON 文本，这里再反序列化成对象返回给前端。
        analysis_text = analyze_jd_match(data.resumeText, data.jdText)
        result = json.loads(analysis_text)

        return {
            "success": True,
            "result": result,
            "source": "llm",
        }
    except Exception as exc:
        # 模型异常或 JSON 解析失败时，仍然给前端一份可展示的默认结构。
        return {
            "success": True,
            "result": {
                "score": 72,
                "matched": [
                    "简历体现出一定的软件开发基础。",
                    "候选人具备项目实践经验。",
                    "存在一定的 AI 应用落地经历。",
                ],
                "missing": [
                    "部分 JD 关键词覆盖还不够明确。",
                    "简历中的成果量化不够充分。",
                    "与目标岗位的针对性还可以进一步加强。",
                ],
                "suggestions": [
                    "补充与岗位更相关的关键词。",
                    "尽量量化项目成果和影响。",
                    "针对不同岗位准备更有针对性的简历版本。",
                ],
            },
            "source": "mock",
            "message": f"大模型分析失败，已返回兜底结果：{str(exc)}",
        }
