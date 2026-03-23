import os
from pathlib import Path
from dotenv import load_dotenv
from openai import OpenAI
from app.services.prompt_builder import (
    build_resume_qa_prompt,
    build_jd_match_prompt
)

env_path = Path(__file__).resolve().parents[2] / ".env"
load_dotenv(dotenv_path=env_path)

API_KEY = os.getenv("API_KEY")
BASE_URL = os.getenv("BASE_URL")
MODEL_NAME = os.getenv("MODEL_NAME")


def get_client():
    if not API_KEY:
        raise ValueError("未读取到 API_KEY，请检查 backend/.env 配置")
    if not MODEL_NAME:
        raise ValueError("未读取到 MODEL_NAME，请检查 backend/.env 配置")

    return OpenAI(
        api_key=API_KEY,
        base_url=BASE_URL,
        timeout=60
    )


def safe_truncate(text: str, max_chars: int = 6000) -> str:
    if not text:
        return ""
    return text[:max_chars]


def ask_resume_question(resume_text: str, question: str) -> str:
    client = get_client()
    resume_text = safe_truncate(resume_text, 5000)
    question = safe_truncate(question, 1000)

    prompt = build_resume_qa_prompt(resume_text, question)

    completion = client.chat.completions.create(
        model=MODEL_NAME,
        messages=[
            {"role": "system", "content": "你是一个专业、严谨的简历问答助手。"},
            {"role": "user", "content": prompt}
        ],
        temperature=0.3,
    )

    return completion.choices[0].message.content.strip()


def analyze_jd_match(resume_text: str, jd_text: str) -> str:
    client = get_client()

    # JD分析比普通问答更容易超时，所以先裁剪输入长度
    resume_text = safe_truncate(resume_text, 4000)
    jd_text = safe_truncate(jd_text, 3000)

    prompt = build_jd_match_prompt(resume_text, jd_text)

    completion = client.chat.completions.create(
        model=MODEL_NAME,
        messages=[
            {"role": "system", "content": "你是一个专业的简历分析与岗位匹配顾问。"},
            {"role": "user", "content": prompt}
        ],
        temperature=0.2,
    )

    return completion.choices[0].message.content.strip()