"""
POST /search — Semantic search across the knowledge base.
"""

import logging

from fastapi import APIRouter, HTTPException

from models import SearchRequest, SearchResponse, SearchResult
from services import rag

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/search", response_model=SearchResponse)
async def search(req: SearchRequest):
    """
    Perform a semantic search over the organisation's indexed documents.
    """
    if not req.query.strip():
        raise HTTPException(status_code=400, detail="Query cannot be empty")

    try:
        results = await rag.search_knowledge(
            organization_id=req.organization_id,
            query=req.query,
            limit=req.limit,
        )

        return SearchResponse(
            results=[
                SearchResult(
                    document_id=r["document_id"],
                    chunk_id=r["chunk_id"],
                    content=r["content"],
                    score=r["score"],
                    document_title=r["document_title"],
                )
                for r in results
            ]
        )

    except Exception as exc:
        logger.error("Search failed (org=%s): %s", req.organization_id, exc)
        raise HTTPException(status_code=500, detail=f"Search failed: {exc}")
