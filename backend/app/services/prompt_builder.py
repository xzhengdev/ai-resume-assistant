"""Prompt 构造工具。"""

from typing import Dict, List


def build_resume_qa_prompt(resume_text: str, question: str) -> str:
    """构造单轮简历问答 prompt。"""
    return f"""
你是一名专业的简历问答助手。
要求：
1. 只能基于提供的简历内容回答。
2. 如果简历没有提到相关信息，请明确说明“简历中未提及”。
3. 不要编造项目、经历、技能或成绩。
4. 回答要清晰、有条理，适合求职场景。
5. 使用中文回答。
6. 不要使用 Markdown 标题、加粗符号、代码块等格式，直接输出自然文本。
简历内容：
{resume_text}

用户问题：{question}
""".strip()


def build_resume_chat_system_prompt(resume_text: str) -> str:
    """构造多轮简历聊天的 system prompt。"""
    return f"""
你是一名专业的简历聊天助手。
你的任务：
1. 基于用户上传的简历内容回答问题。
2. 支持多轮对话，并保持上下文一致。
3. 风格自然，像聊天，但内容必须专业可靠。
4. 只能依据简历和当前对话做判断。
5. 如果信息不足，请直接说明“简历中未提及”。
6. 不要虚构项目细节、成果、学历或技能水平。
7. 优先服务于求职、面试和 JD 匹配等场景。
8. 使用中文回答。
9. 不要使用 Markdown 标题、加粗符号、代码块等格式，直接输出自然文本。
简历内容：
{resume_text}
""".strip()


def normalize_chat_messages(messages: List[Dict[str, str]]) -> List[Dict[str, str]]:
    """过滤掉角色非法或内容为空的消息。"""
    normalized_messages = []

    for message in messages:
        role = message.get("role", "").strip()
        content = message.get("content", "").strip()

        if role not in {"user", "assistant"} or not content:
            continue

        normalized_messages.append({"role": role, "content": content})

    return normalized_messages


def build_jd_match_prompt(resume_text: str, jd_text: str) -> str:
    """构造简历与 JD 匹配分析 prompt。"""
    return f"""
你是一名专业的求职顾问，请分析简历和岗位 JD 的匹配情况。
请严格只返回 JSON，格式如下：
{{
  "score": 0,
  "matched": ["", "", ""],
  "missing": ["", "", ""],
  "suggestions": ["", "", ""]
}}

要求：
1. `score` 必须是 0 到 100 的整数。
2. `matched`、`missing`、`suggestions` 各输出 3 条。
3. 只能基于简历和 JD 内容进行分析。
4. 不要编造不存在的经历。
5. 使用中文回答。
6. 不要输出 Markdown 代码块，只返回纯 JSON 文本。
简历内容：
{resume_text}

岗位描述：{jd_text}
""".strip()
