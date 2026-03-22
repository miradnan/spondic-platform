"""
POST /parse — Parse an RFP document and extract structured questions.
"""

import logging

from fastapi import APIRouter, HTTPException

from models import ExtractedQuestion, ParseRequest, ParseResponse
from services import rag

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/parse", response_model=ParseResponse)
async def parse_rfp(req: ParseRequest):
    """
    Download an RFP document from S3, parse it, and use the LLM to extract
    every question/requirement that needs a response.
    """
    try:
        raw_questions = await rag.parse_rfp(
            organization_id=req.organization_id,
            document_id=req.document_id,
            s3_key=req.s3_key,
        )

        questions = [
            ExtractedQuestion(
                question_text=q.get("question_text", ""),
                section=q.get("section"),
                question_number=q.get("question_number"),
                is_mandatory=q.get("is_mandatory", True),
                word_limit=q.get("word_limit"),
            )
            for q in raw_questions
            if q.get("question_text")
        ]

        return ParseResponse(questions=questions)

    except Exception as exc:
        logger.error("RFP parsing failed for document %s: %s", req.document_id, exc)
        raise HTTPException(status_code=500, detail=f"RFP parsing failed: {exc}")
