"""
POST /chat — RAG-powered conversational endpoint.
POST /chat/stream — SSE streaming conversational endpoint.
"""

import json
import logging

from fastapi import APIRouter, HTTPException
from fastapi.responses import StreamingResponse

from models import ChatCitation, ChatRequest, ChatResponse, TokenUsageResponse
from services import embedder, llm, rag, vectorstore
from services.llm import TokenUsage

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
        usage = TokenUsage()
        history = [{"role": m.role, "content": m.content} for m in req.chat_history]

        result = await rag.chat(
            organization_id=req.organization_id,
            message=req.message,
            chat_history=history,
            usage=usage,
        )

        citations = [
            ChatCitation(
                document_title=c["document_title"],
                citation_text=c["citation_text"],
                relevance_score=c["relevance_score"],
            )
            for c in result["citations"]
        ]

        return ChatResponse(
            response=result["response"],
            citations=citations,
            tokens_used=TokenUsageResponse(**usage.to_dict()),
        )

    except Exception as exc:
        logger.error("Chat failed (org=%s): %s", req.organization_id, exc)
        raise HTTPException(status_code=500, detail=f"Chat failed: {exc}")


@router.post("/chat/stream")
async def chat_stream(req: ChatRequest):
    """SSE streaming chat endpoint."""
    if not req.message.strip():
        raise HTTPException(status_code=400, detail="Message cannot be empty")

    try:
        # 1. Embed + search (non-streaming, fast)
        query_embedding = embedder.embed_single(req.message)
        search_results = vectorstore.hybrid_search(
            organization_id=req.organization_id,
            query_text=req.message,
            query_embedding=query_embedding,
            limit=5,
        )

        usage = TokenUsage()
        history = [{"role": m.role, "content": m.content} for m in req.chat_history]

        # 2. Build citations (send before streaming text)
        citations = [
            {
                "document_title": r.get("document_title", "Unknown"),
                "citation_text": r.get("content", "")[:300],
                "relevance_score": r.get("score", 0.0),
            }
            for r in search_results
        ]

        # 3. Stream response as SSE
        async def event_generator():
            try:
                # First event: citations
                yield f"data: {json.dumps({'type': 'citations', 'citations': citations})}\n\n"

                # Stream text chunks
                for chunk in llm.chat_response_stream(
                    message=req.message,
                    context_passages=search_results,
                    chat_history=history,
                    usage=usage,
                ):
                    yield f"data: {json.dumps({'type': 'text', 'content': chunk})}\n\n"

                # Final event: done with token usage
                yield f"data: {json.dumps({'type': 'done', 'tokens_used': usage.to_dict()})}\n\n"

            except Exception as exc:
                logger.error("Stream error (org=%s): %s", req.organization_id, exc)
                yield f"data: {json.dumps({'type': 'error', 'error': str(exc)})}\n\n"

        return StreamingResponse(
            event_generator(),
            media_type="text/event-stream",
            headers={
                "Cache-Control": "no-cache",
                "Connection": "keep-alive",
                "X-Accel-Buffering": "no",
            },
        )

    except Exception as exc:
        logger.error("Chat stream setup failed (org=%s): %s", req.organization_id, exc)
        raise HTTPException(status_code=500, detail=f"Chat stream failed: {exc}")
