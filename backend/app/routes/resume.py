"""简历上传与解析接口。"""

from pathlib import Path
from uuid import uuid4

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.services.file_parser import parse_resume

router = APIRouter()

# 上传文件只会临时落盘，解析完成后立即删除。
UPLOAD_DIR = Path(__file__).resolve().parents[2] / "uploads"
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)


@router.post("/upload")
async def upload_resume(file: UploadFile = File(...)):
    """接收用户上传的简历文件，解析出纯文本后返回给前端。"""
    file_name = file.filename
    if not file_name:
        raise HTTPException(status_code=400, detail="文件名不能为空。")

    suffix = Path(file_name).suffix
    # 用随机文件名保存，避免用户上传同名文件时相互覆盖。
    file_path = UPLOAD_DIR / f"{uuid4().hex}{suffix}"

    with open(file_path, "wb") as uploaded_file:
        content = await file.read()
        uploaded_file.write(content)

    try:
        # 返回了解析结果
        resume_text = parse_resume(str(file_path))
        return {
            "success": True,
            "fileName": file_name,
            "resumeText": resume_text,
        }
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"简历解析失败：{exc}") from exc
    finally:
        # 解析完成后立即清理临时文件，避免 uploads 目录不断堆积。
        file_path.unlink(missing_ok=True)
