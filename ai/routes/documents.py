"""
DELETE /documents/{document_id} — Remove a document's chunks from the vector store.
"""

import logging

from fastapi import APIRouter, HTTPException, Query

from services import vectorstore

logger = logging.getLogger(__name__)

router = APIRouter()


@router.delete("/documents/{document_id}")
async def delete_document(
    document_id: str,
    organization_id: str = Query(..., description="Organisation ID for tenant isolation"),
):
    """
    Delete all vector store chunks belonging to the specified document.
    Requires organization_id as a query parameter for multi-tenant safety.
    """
    try:
        deleted = vectorstore.delete_document(
            organization_id=organization_id,
            document_id=document_id,
        )
        return {"success": True, "deleted_chunks": deleted}
    except Exception as exc:
        logger.error("Delete failed for document %s (org=%s): %s", document_id, organization_id, exc)
        raise HTTPException(status_code=500, detail=f"Delete failed: {exc}")
