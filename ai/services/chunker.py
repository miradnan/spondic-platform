"""
Text chunking service.

Splits parsed document text into overlapping chunks of approximately
500 tokens each, preserving section headers as metadata.
"""

import logging
import re

import tiktoken

logger = logging.getLogger(__name__)

_ENCODING = tiktoken.encoding_for_model("gpt-3.5-turbo")  # cl100k_base


def _count_tokens(text: str) -> int:
    return len(_ENCODING.encode(text))


def _split_sentences(text: str) -> list[str]:
    """Split text on sentence boundaries (period, question mark, exclamation,
    newline) while keeping short fragments together."""
    raw = re.split(r'(?<=[.!?])\s+|\n{2,}', text)
    return [s.strip() for s in raw if s.strip()]


def chunk_text(
    text: str,
    chunk_size: int = 500,
    overlap: int = 50,
) -> list[dict]:
    """
    Split *text* into chunks of roughly *chunk_size* tokens with *overlap*
    token overlap between consecutive chunks.

    Each chunk carries:
      - content: the text
      - chunk_index: 0-based position
      - section: the most recent section header (or "")
      - token_count: actual tokens in this chunk
    """
    if not text.strip():
        return []

    sentences = _split_sentences(text)
    chunks: list[dict] = []
    current_section = ""
    current_sentences: list[str] = []
    current_tokens = 0
    chunk_index = 0

    def _flush():
        nonlocal chunk_index, current_sentences, current_tokens
        if not current_sentences:
            return
        content = " ".join(current_sentences)
        token_count = _count_tokens(content)
        chunks.append({
            "content": content,
            "chunk_index": chunk_index,
            "section": current_section,
            "token_count": token_count,
        })
        chunk_index += 1

        # Determine overlap sentences to keep
        overlap_sentences: list[str] = []
        overlap_tokens = 0
        for s in reversed(current_sentences):
            s_tokens = _count_tokens(s)
            if overlap_tokens + s_tokens > overlap:
                break
            overlap_sentences.insert(0, s)
            overlap_tokens += s_tokens

        current_sentences.clear()
        current_sentences.extend(overlap_sentences)
        current_tokens = overlap_tokens if overlap_sentences else 0

    for sentence in sentences:
        # Detect section headers (## Header from the parser output)
        header_match = re.match(r'^##\s+(.+)$', sentence)
        if header_match:
            _flush()
            current_section = header_match.group(1).strip()
            continue

        s_tokens = _count_tokens(sentence)

        # If a single sentence exceeds chunk_size, force it into its own chunk
        if s_tokens > chunk_size:
            _flush()
            chunks.append({
                "content": sentence,
                "chunk_index": chunk_index,
                "section": current_section,
                "token_count": s_tokens,
            })
            chunk_index += 1
            current_sentences = []
            current_tokens = 0
            continue

        if current_tokens + s_tokens > chunk_size:
            _flush()

        current_sentences.append(sentence)
        current_tokens += s_tokens

    # Flush remaining
    _flush()

    logger.info("Chunked text into %d chunks (target=%d tokens, overlap=%d)", len(chunks), chunk_size, overlap)
    return chunks
