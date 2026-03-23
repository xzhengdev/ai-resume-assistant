from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.routes import resume, chat, jd

app = FastAPI()

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(resume.router, prefix="/api/resume", tags=["resume"])
app.include_router(chat.router, prefix="/api/chat", tags=["chat"])
app.include_router(jd.router, prefix="/api/jd", tags=["jd"])


@app.get("/")
def read_root():
    return {"message": "backend is running"}