"""简历文件解析工具。"""

from pathlib import Path
from zipfile import ZipFile
import xml.etree.ElementTree as ET

import pdfplumber
from docx import Document


def parse_txt(file_path: str) -> str:
    """直接读取 UTF-8 文本文件内容。"""
    with open(file_path, "r", encoding="utf-8") as file:
        return file.read()


def parse_pdf(file_path: str) -> str:
    """按页提取 PDF 中的文本。"""
    text = []
    with pdfplumber.open(file_path) as pdf:
        for page in pdf.pages:
            page_text = page.extract_text()
            if page_text:
                text.append(page_text)
    return "\n".join(text)


def _dedupe_consecutive_lines(lines: list[str]) -> list[str]:
    """去掉模板文件里常见的连续重复行。"""
    deduped: list[str] = []
    previous = None

    for raw_line in lines:
        line = raw_line.strip()
        if not line:
            continue
        if line == previous:
            continue
        deduped.append(line)
        previous = line

    return deduped


def _extract_docx_xml_text(file_path: str) -> str:
    """
    作为 python-docx 的补充兜底路径，直接扫描 DOCX 内部 XML 文本节点。

    一些简历模板会把文字放在文本框、绘图层等结构里，普通段落接口读不到，
    这时就需要直接从 word/*.xml 里把 w:t 节点提取出来。
    """
    namespaces = {"w": "http://schemas.openxmlformats.org/wordprocessingml/2006/main"}
    lines: list[str] = []

    with ZipFile(file_path) as docx_zip:
        xml_parts = sorted(
            name
            for name in docx_zip.namelist()
            if name.startswith("word/") and name.endswith(".xml")
        )

        for part_name in xml_parts:
            try:
                root = ET.fromstring(docx_zip.read(part_name))
            except ET.ParseError:
                continue

            for node in root.iterfind(".//w:t", namespaces):
                if node.text and node.text.strip():
                    lines.append(node.text.strip())

    return "\n".join(_dedupe_consecutive_lines(lines))


def parse_docx(file_path: str) -> str:
    """优先走普通段落解析，失败时回退到 XML 节点提取。"""
    doc = Document(file_path)
    paragraph_text = "\n".join(_dedupe_consecutive_lines([p.text for p in doc.paragraphs]))

    if paragraph_text.strip():
        return paragraph_text

    xml_text = _extract_docx_xml_text(file_path)
    if xml_text.strip():
        return xml_text

    raise ValueError("DOCX 中未提取到可识别文本，请检查文件是否受保护或内容为图片。")


def parse_resume(file_path: str) -> str:
    """根据文件扩展名分发到对应解析器。"""
    suffix = Path(file_path).suffix.lower()

    if suffix == ".txt":
        return parse_txt(file_path)
    if suffix == ".pdf":
        return parse_pdf(file_path)
    if suffix == ".docx":
        return parse_docx(file_path)

    raise ValueError("不支持的文件格式，仅支持 txt/pdf/docx。")
