"""
RAG orchestration service.

Coordinates the full pipeline: S3 download -> parse -> chunk -> embed -> store,
as well as search, drafting, and chat workflows.
"""

import logging
import os

import re

from services import chunker, embedder, llm, parser, s3, vectorstore
from services.llm import TokenUsage


def _extract_excerpt(content: str, max_len: int = 400) -> str:
    """Extract a meaningful excerpt from chunk content.
    Skips leading section numbers, headers, and boilerplate to show the actual substance."""
    text = content.strip()
    # Strip leading section markers like "1.", "1.1", "Section 3:", "CHAPTER 2 —", "- 1."
    text = re.sub(r"^[-–—\s]*\d+[\.\)]\s*", "", text)
    text = re.sub(r"^(?:section|chapter|part)\s+\d+[\s:—-]*", "", text, flags=re.IGNORECASE)
    # Strip leading ALL-CAPS headers (e.g., "NETWORK SECURITY MONITORING & INCIDENT RESPONSE")
    lines = text.split("\n")
    while lines and (lines[0].strip() == "" or lines[0].strip().isupper()):
        lines.pop(0)
    text = "\n".join(lines).strip() if lines else text.strip()
    # If still empty after stripping, fall back to original
    if not text:
        text = content.strip()
    # Truncate to max_len at a word boundary
    if len(text) > max_len:
        text = text[:max_len].rsplit(" ", 1)[0] + "..."
    return text

logger = logging.getLogger(__name__)


# --------------------------------------------------------------------------- #
# Indexing
# --------------------------------------------------------------------------- #

async def index_document(
    organization_id: str,
    document_id: str,
    s3_key: str,
    title: str,
    source_type: str,
) -> dict:
    """
    Full indexing pipeline:
      1. Download file from S3
      2. Parse document text
      3. Chunk text
      4. Generate embeddings
      5. Store in Weaviate

    Returns dict with chunks_created and weaviate_object_ids.
    """
    logger.info("Indexing document %s (org=%s, key=%s)", document_id, organization_id, s3_key)

    # 1. Download
    local_path = s3.download_file(s3_key)

    try:
        # 2. Parse
        text = parser.parse_document(local_path, file_type=source_type)
        if not text.strip():
            logger.warning("Parsed document is empty: %s", s3_key)
            return {"chunks_created": 0, "weaviate_object_ids": []}

        # 3. Chunk
        chunks = chunker.chunk_text(text)
        if not chunks:
            logger.warning("No chunks produced for document %s", document_id)
            return {"chunks_created": 0, "weaviate_object_ids": []}

        # 4. Embed
        texts = [c["content"] for c in chunks]
        embeddings = embedder.embed_texts(texts)

        # 5. Store
        object_ids = vectorstore.store_chunks(
            organization_id=organization_id,
            document_id=document_id,
            document_title=title,
            chunks=chunks,
            embeddings=embeddings,
        )

        logger.info("Indexed %d chunks for document %s", len(object_ids), document_id)
        return {"chunks_created": len(object_ids), "weaviate_object_ids": object_ids}

    finally:
        # Clean up temp file
        try:
            os.unlink(local_path)
        except OSError:
            pass


# --------------------------------------------------------------------------- #
# RFP Question Extraction
# --------------------------------------------------------------------------- #

async def parse_rfp(
    organization_id: str,
    document_id: str,
    s3_key: str,
    usage: TokenUsage | None = None,
) -> list[dict]:
    """
    Parse an RFP document and extract structured questions.

    Returns a list of question dicts with keys:
      question_text, section, question_number, is_mandatory, word_limit
    """
    logger.info("Parsing RFP for question extraction: %s (org=%s)", document_id, organization_id)

    local_path = s3.download_file(s3_key)

    try:
        text = parser.parse_document(local_path)
        if not text.strip():
            logger.warning("RFP document is empty: %s", s3_key)
            return []

        questions = llm.extract_questions(text, usage=usage)
        logger.info("Extracted %d questions from RFP %s", len(questions), document_id)
        return questions

    finally:
        try:
            os.unlink(local_path)
        except OSError:
            pass


# --------------------------------------------------------------------------- #
# Answer Drafting
# --------------------------------------------------------------------------- #

async def draft_answers(
    organization_id: str,
    questions: list[dict],
    usage: TokenUsage | None = None,
) -> list[dict]:
    """
    Draft answers for a list of questions using RAG.

    Each question dict must have: id, question_text, and optionally section.

    Returns a list of answer dicts:
      question_id, draft_text, confidence_score, citations
    """
    logger.info("Drafting answers for %d questions (org=%s)", len(questions), organization_id)
    answers: list[dict] = []

    for q in questions:
        question_id = q["id"]
        question_text = q["question_text"]

        try:
            # 1. Embed the question
            query_embedding = embedder.embed_single(question_text)

            # 2. Search for relevant context
            search_results = vectorstore.hybrid_search(
                organization_id=organization_id,
                query_text=question_text,
                query_embedding=query_embedding,
                limit=5,
            )

            # 3. Generate answer
            if search_results:
                draft_text = llm.generate_answer(question_text, search_results, usage=usage)
            else:
                draft_text = (
                    "Insufficient information found in the knowledge base to answer this question. "
                    "Please upload relevant documents or provide additional context."
                )

            # 4. Calculate confidence score (average of top result scores)
            if search_results:
                scores = [r["score"] for r in search_results]
                confidence = round(sum(scores) / len(scores), 4)
            else:
                confidence = 0.0

            # 5. Build citations — store the exact chunk text retrieved from the vector store
            citations = [
                {
                    "document_id": r["document_id"],
                    "chunk_id": r["chunk_id"],
                    "citation_text": r["content"].strip(),
                    "document_title": r.get("document_title", ""),
                    "relevance_score": r["score"],
                }
                for r in search_results
            ]

            answers.append({
                "question_id": question_id,
                "draft_text": draft_text,
                "confidence_score": confidence,
                "citations": citations,
            })

        except Exception as exc:
            logger.error("Failed to draft answer for question %s: %s", question_id, exc)
            answers.append({
                "question_id": question_id,
                "draft_text": f"Error generating answer: {exc}",
                "confidence_score": 0.0,
                "citations": [],
            })

    return answers


# --------------------------------------------------------------------------- #
# Index Approved Answer
# --------------------------------------------------------------------------- #

async def index_approved_answer(
    organization_id: str,
    answer_id: str,
    question_text: str,
    answer_text: str,
    project_name: str = "",
    section: str = "",
) -> str:
    """
    Embed an approved Q&A pair and store it in Weaviate so future RAG
    searches can retrieve proven answers for similar questions.

    Deduplication:
      1. Deterministic UUID from answer_id — re-approving the same answer upserts.
      2. Semantic check — if an existing object is ≥95% similar, skip the insert
         to avoid near-duplicate clutter from similar questions across RFPs.

    Returns the Weaviate object UUID, or empty string if skipped as duplicate.
    """
    logger.info("Indexing approved answer %s (org=%s)", answer_id, organization_id)

    # Clean the answer text: strip HTML tags, citation markers [Source N] / [N],
    # and [ENTER: ...] placeholders so only the real content gets embedded.
    clean_answer = re.sub(r"<[^>]+>", "", answer_text)            # strip HTML
    clean_answer = re.sub(r"\[Source\s*\d+\]", "", clean_answer)  # [Source 1]
    clean_answer = re.sub(r"\[\d+\]", "", clean_answer)           # [1]
    clean_answer = re.sub(r"\[ENTER:\s*[^\]]+\]", "", clean_answer)  # [ENTER: ...]
    clean_answer = re.sub(r"\s{2,}", " ", clean_answer).strip()   # collapse whitespace

    content = f"Q: {question_text}\n\nA: {clean_answer}"
    embedding = embedder.embed_single(content)

    # Semantic dedup: skip if a near-identical entry already exists
    existing = vectorstore.find_near_duplicate(
        organization_id=organization_id,
        embedding=embedding,
        similarity_threshold=0.95,
    )
    if existing and existing["document_id"] != answer_id:
        logger.info(
            "Skipping approved answer %s — near duplicate of %s (%.1f%% similar)",
            answer_id, existing["document_id"], existing["score"] * 100,
        )
        return ""

    # Build a descriptive title
    q_snippet = question_text[:60].rstrip() + ("..." if len(question_text) > 60 else "")
    title = f"Approved: {project_name} — {q_snippet}" if project_name else f"Approved Answer — {q_snippet}"

    # Upsert with deterministic UUID (same answer_id → same Weaviate object)
    object_id = vectorstore.upsert_approved_answer(
        organization_id=organization_id,
        answer_id=answer_id,
        document_title=title,
        content=content,
        section=section,
        embedding=embedding,
    )

    logger.info("Indexed approved answer %s → Weaviate %s", answer_id, object_id)
    return object_id


async def remove_approved_answer(organization_id: str, answer_id: str) -> None:
    """Remove an approved answer from Weaviate when it's un-approved."""
    deleted = vectorstore.delete_by_document_id(organization_id, answer_id)
    logger.info("Removed approved answer %s from Weaviate (%d objects deleted)", answer_id, deleted)


# --------------------------------------------------------------------------- #
# Chat
# --------------------------------------------------------------------------- #

async def chat(
    organization_id: str,
    message: str,
    chat_history: list[dict] | None = None,
    usage: TokenUsage | None = None,
) -> dict:
    """
    RAG-powered chat: embed query, retrieve context, generate response.

    Returns dict with response and citations.
    """
    logger.info("Chat request (org=%s): %s", organization_id, message[:80])

    # 1. Embed the user message
    query_embedding = embedder.embed_single(message)

    # 2. Retrieve relevant context
    search_results = vectorstore.hybrid_search(
        organization_id=organization_id,
        query_text=message,
        query_embedding=query_embedding,
        limit=5,
    )

    # 3. Generate response
    response_text = llm.chat_response(
        message=message,
        context_passages=search_results,
        chat_history=chat_history,
        usage=usage,
    )

    # 4. Build citations — store the exact chunk text retrieved
    citations = [
        {
            "document_title": r["document_title"],
            "citation_text": r["content"].strip(),
            "relevance_score": r["score"],
        }
        for r in search_results
    ]

    return {"response": response_text, "citations": citations}


# --------------------------------------------------------------------------- #
# Search
# --------------------------------------------------------------------------- #

async def search_knowledge(
    organization_id: str,
    query: str,
    limit: int = 10,
) -> list[dict]:
    """
    Semantic search across the organisation's knowledge base.
    """
    query_embedding = embedder.embed_single(query)

    results = vectorstore.hybrid_search(
        organization_id=organization_id,
        query_text=query,
        query_embedding=query_embedding,
        limit=limit,
    )

    return results
