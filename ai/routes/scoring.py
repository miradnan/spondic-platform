"""
POST /rfp/score — Go/No-Go RFP scoring endpoint.
"""

import logging

from fastapi import APIRouter, HTTPException

from models import ScoreRequest, ScoreResponse
from services import scoring

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/rfp/score", response_model=ScoreResponse)
async def score_rfp_endpoint(request: ScoreRequest):
    """
    Score an RFP against the organisation's knowledge base.

    Evaluates coverage for each extracted requirement, identifies capability
    gaps, assesses risk, and returns a go/conditional/no-go recommendation.
    """
    try:
        result = await scoring.score_rfp(
            organization_id=request.organization_id,
            document_id=request.document_id,
            s3_key=request.s3_key,
        )
        return ScoreResponse(**result)
    except Exception as exc:
        logger.error("RFP scoring failed for document %s: %s", request.document_id, exc)
        raise HTTPException(status_code=500, detail=f"RFP scoring failed: {exc}")
