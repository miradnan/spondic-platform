"""
POST /chat — RAG-powered conversational endpoint.
"""

import logging

from fastapi import APIRouter, HTTPException

from models import ChatCitation, ChatRequest, ChatResponse
from services import rag

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/chat", response_model=ChatResponse)
async def chat(req: ChatRequest):
    """
    Send a user message, retrieve relevant knowledge base context,
    and return an LLM-generated response with citations.
    """
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    try:
        history = [{"role": m.role, "content": m.content} for m in req.chat_history]

        result = await rag.chat(
            organization_id=req.organization_id,
            message=req.message,
            chat_history=history,
        )

        citations = [
            ChatCitation(
                document_title=c["document_title"],
                citation_text=c["citation_text"],
                relevance_score=c["relevance_score"],
            )
            for c in result["citations"]
        ]

        return ChatResponse(response=result["response"], citations=citations)

    except Exception as exc:
        logger.error("Chat failed (org=%s): %s", req.organization_id, exc)
        raise HTTPException(status_code=500, detail=f"Chat failed: {exc}")
