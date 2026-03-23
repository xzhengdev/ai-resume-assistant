import json
from fastapi import APIRouter, HTTPException
from pydantic import BaseModel
from app.services.llm_service import analyze_jd_match

router = APIRouter()


class JDMatchRequest(BaseModel):
    resumeText: str
    jdText: str


@router.post("/match")
async def match_jd(data: JDMatchRequest):
    if not data.resumeText.strip():
        raise HTTPException(status_code=400, detail="简历内容不能为空")

    if not data.jdText.strip():
        raise HTTPException(status_code=400, detail="JD 内容不能为空")

    try:
        analysis_text = analyze_jd_match(data.resumeText, data.jdText)
        result = json.loads(analysis_text)

        return {
            "success": True,
            "result": result,
            "source": "llm"
        }
    except Exception as e:
        return {
            "success": True,
            "result": {
                "score": 72,
                "matched": [
                    "具备基础开发能力",
                    "有项目实践经历",
                    "有一定 AI 应用落地经验"
                ],
                "missing": [
                    "部分岗位关键词覆盖不足",
                    "简历中成果量化不够明显",
                    "针对目标岗位的描述还不够聚焦"
                ],
                "suggestions": [
                    "补充和岗位强相关的技术关键词",
                    "增加项目成果的量化描述",
                    "根据不同岗位准备更有针对性的简历版本"
                ]
            },
            "source": "mock",
            "message": f"大模型分析失败，已返回兜底结果。原因：{str(e)}"
        }