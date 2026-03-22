"""
POST /draft-with-review — Draft answers with multi-agent review and compliance checking.
"""

import logging

from fastapi import APIRouter, HTTPException

from models import (
    Citation,
    ComplianceFlag,
    DraftAnswer,
    DraftWithReviewRequest,
    DraftWithReviewResponse,
    ReviewComment,
)
from services.agents import run_multi_agent_pipeline

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/draft-with-review", response_model=DraftWithReviewResponse)
async def draft_with_review(req: DraftWithReviewRequest):
    """
    Draft answers for RFP questions using RAG, then run Review and Compliance
    agents to evaluate quality and flag risks.
    """
    if not req.questions:
        raise HTTPException(status_code=400, detail="No questions provided")

    try:
        questions = [
            {"id": q.id, "question_text": q.question_text, "section": q.section}
            for q in req.questions
        ]

        result = await run_multi_agent_pipeline(
            organization_id=req.organization_id,
            project_id=req.project_id,
            questions=questions,
        )

        # Convert raw dicts to Pydantic models
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
            for a in result["answers"]
        ]

        review_comments = [
            ReviewComment(
                question_id=rc.get("question_id", ""),
                comment=rc.get("comment", ""),
                suggested_edit=rc.get("suggested_edit"),
                quality_score=rc.get("quality_score", 0.0),
            )
            for rc in result["review_comments"]
        ]

        compliance_flags = [
            ComplianceFlag(
                question_id=cf.get("question_id", ""),
                flag_type=cf.get("flag_type", "info"),
                description=cf.get("description", ""),
                standard=cf.get("standard"),
            )
            for cf in result["compliance_flags"]
        ]

        return DraftWithReviewResponse(
            answers=answers,
            review_comments=review_comments,
            compliance_flags=compliance_flags,
            overall_score=result["overall_score"],
        )

    except Exception as exc:
        logger.error("Multi-agent pipeline failed for project %s: %s", req.project_id, exc)
        raise HTTPException(status_code=500, detail=f"Multi-agent pipeline failed: {exc}")
