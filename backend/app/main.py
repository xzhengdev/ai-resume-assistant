"""后端应用入口。"""

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import resume, chat, jd

# 当前项目接口不多，一个 FastAPI 实例就足够承载全部能力。
app = FastAPI()

# 本地开发时前后端分开运行，所以这里直接放开跨域限制。
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# 三个路由分别负责：简历上传解析、简历问答、JD 匹配分析。
app.include_router(resume.router, prefix="/api/resume", tags=["resume"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(jd.router, prefix="/api/jd", tags=["jd"])


@app.get("/")
def read_root():
    """最小健康检查接口，用来确认后端服务是否正常启动。"""
    return {"message": "backend is running"}
