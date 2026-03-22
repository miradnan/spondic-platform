"""
POST /draft — Draft answers for a set of RFP questions using RAG.
"""

import logging

from fastapi import APIRouter, HTTPException

from models import Citation, DraftAnswer, DraftRequest, DraftResponse
from services import rag

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/draft", response_model=DraftResponse)
async def draft_answers(req: DraftRequest):
    """
    For each question, retrieve relevant context from the knowledge base
    and generate a cited answer via LLM.
    """
    if not req.questions:
        raise HTTPException(status_code=400, detail="No questions provided")

    try:
        questions = [
            {"id": q.id, "question_text": q.question_text, "section": q.section}
            for q in req.questions
        ]

        raw_answers = await rag.draft_answers(
            organization_id=req.organization_id,
            questions=questions,
        )

        answers = [
            DraftAnswer(
                question_id=a["question_id"],
                draft_text=a["draft_text"],
                confidence_score=a["confidence_score"],
                citations=[
                    Citation(
                        document_id=c["document_id"],
                        chunk_id=c["chunk_id"],
                        citation_text=c["citation_text"],
                        relevance_score=c["relevance_score"],
                    )
                    for c in a["citations"]
                ],
            )
            for a in raw_answers
        ]

        return DraftResponse(answers=answers)

    except Exception as exc:
        logger.error("Drafting failed for project %s: %s", req.project_id, exc)
        raise HTTPException(status_code=500, detail=f"Drafting failed: {exc}")
