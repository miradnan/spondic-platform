"""
Local embedding generation using sentence-transformers.

Uses all-MiniLM-L6-v2 for vector embeddings — runs locally, no API key needed.
"""

import logging

from sentence_transformers import SentenceTransformer

logger = logging.getLogger(__name__)

_MODEL_NAME = "all-MiniLM-L6-v2"
_model: SentenceTransformer | None = None


def _get_model() -> SentenceTransformer:
    global _model
    if _model is None:
        logger.info("Loading embedding model: %s", _MODEL_NAME)
        _model = SentenceTransformer(_MODEL_NAME)
        logger.info("Embedding model loaded")
    return _model


def embed_texts(texts: list[str]) -> list[list[float]]:
    """
    Generate embeddings for a list of texts using a local model.

    Returns a list of embedding vectors (one per input text).
    """
    if not texts:
        return []

    model = _get_model()
    embeddings = model.encode(texts, show_progress_bar=False)
    result = [emb.tolist() for emb in embeddings]
    logger.info("Generated %d embeddings via %s", len(result), _MODEL_NAME)
    return result


def embed_single(text: str) -> list[float]:
    """Convenience wrapper to embed a single text."""
    result = embed_texts([text])
    return result[0]
