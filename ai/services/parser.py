"""
Document parsing service using the Unstructured library.

Supports PDF, DOCX, XLSX, and TXT files.
"""

import logging
import os

logger = logging.getLogger(__name__)


def _file_type_from_path(file_path: str) -> str:
    """Infer file type from extension."""
    ext = os.path.splitext(file_path)[1].lower().lstrip(".")
    mapping = {
        "pdf": "pdf",
        "docx": "docx",
        "doc": "docx",
        "xlsx": "xlsx",
        "xls": "xlsx",
        "txt": "txt",
        "csv": "txt",
        "md": "txt",
    }
    return mapping.get(ext, "txt")


def parse_document(file_path: str, file_type: str | None = None) -> str:
    """
    Parse a document and return its plain-text content.

    Section markers and headers are preserved in the output to support
    downstream chunking that retains section metadata.

    Args:
        file_path: Path to the local file.
        file_type: One of pdf, docx, xlsx, txt. Auto-detected if None.

    Returns:
        Extracted plain text.
    """
    if file_type is None:
        file_type = _file_type_from_path(file_path)

    logger.info("Parsing document: %s (type=%s)", file_path, file_type)

    try:
        if file_type == "pdf":
            return _parse_pdf(file_path)
        elif file_type == "docx":
            return _parse_docx(file_path)
        elif file_type == "xlsx":
            return _parse_xlsx(file_path)
        else:
            return _parse_text(file_path)
    except Exception as exc:
        logger.error("Failed to parse %s: %s", file_path, exc)
        # Attempt a plain-text fallback so partial content is still usable
        try:
            return _parse_text(file_path)
        except Exception:
            raise RuntimeError(f"Document parsing failed for {file_path}") from exc


def _parse_pdf(file_path: str) -> str:
    from unstructured.partition.pdf import partition_pdf

    elements = partition_pdf(
        filename=file_path,
        strategy="hi_res",
        infer_table_structure=True,
    )
    return _elements_to_text(elements)


def _parse_docx(file_path: str) -> str:
    from unstructured.partition.docx import partition_docx

    elements = partition_docx(filename=file_path)
    return _elements_to_text(elements)


def _parse_xlsx(file_path: str) -> str:
    from unstructured.partition.xlsx import partition_xlsx

    elements = partition_xlsx(filename=file_path)
    return _elements_to_text(elements)


def _parse_text(file_path: str) -> str:
    from unstructured.partition.text import partition_text

    elements = partition_text(filename=file_path)
    return _elements_to_text(elements)


def _elements_to_text(elements) -> str:
    """
    Convert Unstructured elements into a single string, preserving section
    headers with Markdown-style markers so the chunker can pick them up.
    """
    parts: list[str] = []
    for el in elements:
        category = getattr(el, "category", None)
        text = str(el).strip()
        if not text:
            continue
        if category in ("Title", "Header"):
            parts.append(f"\n## {text}\n")
        elif category == "ListItem":
            parts.append(f"- {text}")
        else:
            parts.append(text)
    return "\n".join(parts)
