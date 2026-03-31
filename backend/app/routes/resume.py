import os

from fastapi import APIRouter, File, HTTPException, UploadFile

from app.services.file_parser import parse_resume

router = APIRouter()

UPLOAD_DIR = "uploads"
os.makedirs(UPLOAD_DIR, exist_ok=True)


@router.post("/upload")
async def upload_resume(file: UploadFile = File(...)):
    file_name = file.filename
    if not file_name:
        raise HTTPException(status_code=400, detail="文件名不能为空。")

    file_path = os.path.join(UPLOAD_DIR, file_name)

    with open(file_path, "wb") as f:
        content = await file.read()
        f.write(content)

    try:
        resume_text = parse_resume(file_path)
        return {
            "success": True,
            "fileName": file_name,
            "resumeText": resume_text,
        }
    except Exception as e:
        raise HTTPException(status_code=500, detail=f"简历解析失败：{str(e)}")
