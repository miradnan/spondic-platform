"""
POST /index-answer — Index an approved answer into the vector store for future RAG retrieval.
DELETE /index-answer — Remove an approved answer from the vector store when un-approved.
"""

import logging

from fastapi import APIRouter, HTTPException

from models import IndexAnswerRequest, IndexAnswerResponse, RemoveAnswerRequest
from services import rag

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/index-answer", response_model=IndexAnswerResponse)
async def index_answer(req: IndexAnswerRequest):
    """
    Embed an approved Q&A pair and store it in Weaviate so similar future
    questions can retrieve this proven answer as context.

    Deduplication: skips insert if a ≥95% similar entry already exists.
    """
    try:
        object_id = await rag.index_approved_answer(
            organization_id=req.organization_id,
            answer_id=req.answer_id,
            question_text=req.question_text,
            answer_text=req.answer_text,
            project_name=req.project_name,
            section=req.section,
        )
        return IndexAnswerResponse(
            status="ok",
            weaviate_object_id=object_id,
            skipped_as_duplicate=object_id == "",
        )
    except Exception as exc:
        logger.error("Failed to index approved answer %s: %s", req.answer_id, exc)
        raise HTTPException(status_code=500, detail=f"Index answer failed: {exc}")


@router.delete("/index-answer")
async def remove_answer(req: RemoveAnswerRequest):
    """Remove an approved answer from Weaviate when it is un-approved."""
    try:
        await rag.remove_approved_answer(
            organization_id=req.organization_id,
            answer_id=req.answer_id,
        )
        return {"status": "ok"}
    except Exception as exc:
        logger.error("Failed to remove answer %s from Weaviate: %s", req.answer_id, exc)
        raise HTTPException(status_code=500, detail=f"Remove answer failed: {exc}")
