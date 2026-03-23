def build_resume_qa_prompt(resume_text: str, question: str) -> str:
    return f"""
你是一名专业的简历问答助手，请严格根据给定的简历内容回答用户问题。

要求：
1. 只能基于简历内容回答
2. 如果简历中没有相关信息，请明确说明“简历中未提及”
3. 不要编造项目、经历、技能或成绩
4. 回答尽量清晰、有条理、适合求职场景
5. 使用中文回答

简历内容：
{resume_text}

用户问题：
{question}
""".strip()


def build_jd_match_prompt(resume_text: str, jd_text: str) -> str:
    return f"""
你是一名专业的求职顾问，请根据简历和岗位JD做匹配分析。

请严格返回 JSON，不要输出多余文字，格式如下：
{{
  "score": 0,
  "matched": ["", "", ""],
  "missing": ["", "", ""],
  "suggestions": ["", "", ""]
}}

要求：
1. score 为 0-100 的整数
2. matched、missing、suggestions 各输出 3 条
3. 只能基于简历和JD内容分析
4. 不要编造不存在的经历
5. 使用中文

简历内容：
{resume_text}

岗位JD：
{jd_text}
""".strip()