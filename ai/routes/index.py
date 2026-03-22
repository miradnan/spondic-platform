"""
POST /index — Index a document into the vector store.
"""

import logging

from fastapi import APIRouter, HTTPException

from models import IndexRequest, IndexResponse
from services import rag

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/index", response_model=IndexResponse)
async def index_document(req: IndexRequest):
    """
    Accept a document reference, download from S3, parse, chunk, embed,
    and store in Weaviate.
    """
    try:
        result = await rag.index_document(
            organization_id=req.organization_id,
            document_id=req.document_id,
            s3_key=req.s3_key,
            title=req.title,
            source_type=req.source_type,
        )
        return IndexResponse(
            success=True,
            chunks_created=result["chunks_created"],
            weaviate_object_ids=result["weaviate_object_ids"],
        )
    except Exception as exc:
        logger.error("Indexing failed for document %s: %s", req.document_id, exc)
        raise HTTPException(status_code=500, detail=f"Indexing failed: {exc}")
