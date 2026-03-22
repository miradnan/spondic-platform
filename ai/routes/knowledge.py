"""
Knowledge Base management routes.

Provides auto-tagging, stale document detection, duplicate detection,
and freshness reporting endpoints.
"""

import logging

from fastapi import APIRouter, HTTPException, Query

from models import (
    AutoTagRequest,
    AutoTagResponse,
    DuplicateGroup,
    FreshnessReportItem,
    StaleDocumentResponse,
)
from services import knowledge

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/documents/{document_id}/auto-tag", response_model=AutoTagResponse)
async def auto_tag(document_id: str, request: AutoTagRequest):
    """
    Auto-tag a document by analysing its content with an LLM.
    Returns extracted tags, industry, document type, and domain.
    """
    try:
        result = await knowledge.auto_tag_document(
            organization_id=request.organization_id,
            document_id=document_id,
            s3_key=request.s3_key,
        )
        return AutoTagResponse(**result)
    except Exception as exc:
        logger.error("Auto-tagging failed for document %s: %s", document_id, exc)
        raise HTTPException(status_code=500, detail=f"Auto-tagging failed: {exc}")


@router.get("/documents/stale", response_model=list[StaleDocumentResponse])
async def get_stale(
    organization_id: str = Query(..., description="Organisation ID for tenant isolation"),
    threshold_days: int = Query(90, description="Number of days after which a document is considered stale"),
):
    """
    Detect documents older than the given threshold.
    """
    try:
        results = await knowledge.detect_stale_documents(
            organization_id=organization_id,
            threshold_days=threshold_days,
        )
        return [StaleDocumentResponse(**r) for r in results]
    except Exception as exc:
        logger.error("Stale document detection failed (org=%s): %s", organization_id, exc)
        raise HTTPException(status_code=500, detail=f"Stale document detection failed: {exc}")


@router.get("/documents/duplicates", response_model=list[DuplicateGroup])
async def get_duplicates(
    organization_id: str = Query(..., description="Organisation ID for tenant isolation"),
    similarity_threshold: float = Query(0.92, description="Minimum similarity score to consider documents as duplicates"),
):
    """
    Detect near-duplicate documents by comparing first-chunk embeddings.
    """
    try:
        results = await knowledge.detect_duplicates(
            organization_id=organization_id,
            similarity_threshold=similarity_threshold,
        )
        return [DuplicateGroup(**r) for r in results]
    except Exception as exc:
        logger.error("Duplicate detection failed (org=%s): %s", organization_id, exc)
        raise HTTPException(status_code=500, detail=f"Duplicate detection failed: {exc}")


@router.get("/documents/freshness-report", response_model=list[FreshnessReportItem])
async def get_freshness(
    organization_id: str = Query(..., description="Organisation ID for tenant isolation"),
    max_fresh_days: int = Query(180, description="Maximum age in days for a document to be considered fully fresh"),
):
    """
    Generate a freshness report for all documents in the organisation.
    Documents are sorted by freshness score (stalest first).
    """
    try:
        results = await knowledge.freshness_report(
            organization_id=organization_id,
            max_fresh_days=max_fresh_days,
        )
        return [FreshnessReportItem(**r) for r in results]
    except Exception as exc:
        logger.error("Freshness report failed (org=%s): %s", organization_id, exc)
        raise HTTPException(status_code=500, detail=f"Freshness report failed: {exc}")
