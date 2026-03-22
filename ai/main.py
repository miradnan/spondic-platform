"""
Spondic AI Service

FastAPI application providing RAG-powered document indexing, RFP question
extraction, answer drafting, chat, and semantic search.
"""

import logging
from contextlib import asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from config import settings
from routes import agents, chat, compliance, documents, draft, health, index, knowledge, parse, scoring, search
from services import vectorstore

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s  %(levelname)-8s  %(name)s  %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Startup: connect to Weaviate and ensure schema.  Shutdown: close client."""
    logger.info("Starting Spondic AI service")
    try:
        vectorstore.init_client()
    except Exception as exc:
        logger.warning("Weaviate connection failed on startup (service will retry on first request): %s", exc)
    yield
    vectorstore.close_client()
    logger.info("Spondic AI service shut down")


app = FastAPI(
    title="Spondic AI",
    version="1.0.0",
    description="AI service for RAG-powered RFP response drafting",
    lifespan=lifespan,
)

# CORS
app.add_middleware(
    CORSMiddleware,
    allow_origins=[o.strip() for o in settings.cors_origins.split(",") if o.strip()],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register route modules
app.include_router(health.router)
app.include_router(index.router)
app.include_router(parse.router)
app.include_router(draft.router)
app.include_router(chat.router)
app.include_router(search.router)
app.include_router(documents.router)
app.include_router(agents.router, tags=["agents"])
app.include_router(compliance.router, tags=["compliance"])
app.include_router(knowledge.router, tags=["knowledge"])
app.include_router(scoring.router, tags=["scoring"])


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(app, host="0.0.0.0", port=settings.port)
