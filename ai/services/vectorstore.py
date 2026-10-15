"""
Qdrant vector store service.

Manages the document chunk collection: schema creation, chunk storage,
vector/hybrid search, and deletion. All searches enforce multi-tenant
isolation via organization_id filtering.

Each point carries a dense vector (sentence-transformers embedding) and a
BM25 sparse vector that Qdrant computes server-side from the chunk text.
Hybrid search fuses the two with relative score fusion so scores stay in
0..1 and keep the same meaning for callers' thresholds.
"""

import logging
import time
from datetime import datetime, timezone
from typing import Any
from uuid import NAMESPACE_URL, uuid4, uuid5

from qdrant_client import QdrantClient, models

from config import settings

logger = logging.getLogger(__name__)

DENSE_VECTOR = "dense"
SPARSE_VECTOR = "bm25"
BM25_MODEL = "qdrant/bm25"
EMBEDDING_DIM = 384  # all-MiniLM-L6-v2
HYBRID_ALPHA = 0.7  # 0.7 = lean toward vector, 0.3 toward keyword
UPSERT_BATCH_SIZE = 64
SCROLL_PAGE_SIZE = 256

# Module-level client reference, initialised in init_client()
_client: QdrantClient | None = None


# --------------------------------------------------------------------------- #
# Lifecycle
# --------------------------------------------------------------------------- #

def init_client() -> None:
    """Connect to Qdrant and create the collection schema if needed."""
    global _client
    logger.info("Connecting to Qdrant at %s", settings.qdrant_url)

    _client = QdrantClient(
        url=settings.qdrant_url,
        # port=None keeps the URL's own port; otherwise the client forces 6333,
        # which breaks HTTPS endpoints served on 443.
        port=None,
        api_key=settings.qdrant_api_key or None,
        # Lets Qdrant compute BM25 sparse vectors from models.Document server-side.
        cloud_inference=True,
        timeout=30,
    )

    _ensure_schema()
    logger.info("Qdrant client ready")


def close_client() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None
        logger.info("Qdrant client closed")


def _get_client() -> QdrantClient:
    # Connect lazily so a Qdrant outage at startup recovers on the next request.
    if _client is None:
        init_client()
    return _client


def _ensure_schema() -> None:
    """
    Create the collection and payload indexes if they do not already exist.

    In production the service holds a collection-scoped JWT that cannot create
    collections, so the collection must be provisioned once with the admin key.
    """
    client = _get_client()
    collection = settings.qdrant_collection

    if client.collection_exists(collection):
        logger.info("Collection '%s' already exists", collection)
        return

    logger.info("Creating collection '%s'", collection)
    client.create_collection(
        collection_name=collection,
        vectors_config={
            DENSE_VECTOR: models.VectorParams(size=EMBEDDING_DIM, distance=models.Distance.COSINE),
        },
        sparse_vectors_config={
            SPARSE_VECTOR: models.SparseVectorParams(modifier=models.Modifier.IDF),
        },
    )
    # is_tenant co-locates each organisation's points for faster filtered search.
    client.create_payload_index(
        collection, "organization_id",
        models.KeywordIndexParams(type=models.KeywordIndexType.KEYWORD, is_tenant=True),
    )
    client.create_payload_index(collection, "document_id", models.PayloadSchemaType.KEYWORD)
    client.create_payload_index(collection, "chunk_index", models.PayloadSchemaType.INTEGER)
    logger.info("Collection '%s' created", collection)


def _org_filter(organization_id: str, **extra: Any) -> models.Filter:
    conditions = [models.FieldCondition(key="organization_id", match=models.MatchValue(value=organization_id))]
    for key, value in extra.items():
        conditions.append(models.FieldCondition(key=key, match=models.MatchValue(value=value)))
    return models.Filter(must=conditions)


def _point(point_id: str, content: str, embedding: list[float], payload: dict) -> models.PointStruct:
    return models.PointStruct(
        id=point_id,
        vector={
            DENSE_VECTOR: embedding,
            SPARSE_VECTOR: models.Document(text=content, model=BM25_MODEL),
        },
        payload={**payload, "content": content, "created_at": time.time()},
    )


# --------------------------------------------------------------------------- #
# Store
# --------------------------------------------------------------------------- #

def store_chunks(
    organization_id: str,
    document_id: str,
    document_title: str,
    chunks: list[dict],
    embeddings: list[list[float]],
) -> list[str]:
    """
    Store document chunks with their embedding vectors in Qdrant.

    Returns a list of point UUIDs (as strings).
    """
    client = _get_client()
    points = [
        _point(
            str(uuid4()),
            chunk["content"],
            embedding,
            {
                "organization_id": organization_id,
                "document_id": document_id,
                "chunk_index": chunk["chunk_index"],
                "section": chunk.get("section", ""),
                "document_title": document_title,
            },
        )
        for chunk, embedding in zip(chunks, embeddings)
    ]

    for start in range(0, len(points), UPSERT_BATCH_SIZE):
        client.upsert(settings.qdrant_collection, points=points[start:start + UPSERT_BATCH_SIZE], wait=True)

    logger.info(
        "Stored %d chunks for document %s (org=%s)",
        len(points), document_id, organization_id,
    )
    return [str(p.id) for p in points]


def upsert_approved_answer(
    organization_id: str,
    answer_id: str,
    document_title: str,
    content: str,
    section: str,
    embedding: list[float],
) -> str:
    """
    Store an approved answer with a deterministic UUID (derived from answer_id)
    so re-approving the same answer overwrites rather than duplicates.

    Returns the point UUID as a string.
    """
    client = _get_client()

    # Deterministic UUID: same answer_id always maps to the same point
    point_id = str(uuid5(NAMESPACE_URL, f"approved-answer:{answer_id}"))

    client.upsert(
        settings.qdrant_collection,
        points=[_point(point_id, content, embedding, {
            "organization_id": organization_id,
            "document_id": answer_id,
            "chunk_index": 0,
            "section": section,
            "document_title": document_title,
        })],
        wait=True,
    )

    logger.info("Upserted approved answer %s → %s (org=%s)", answer_id, point_id, organization_id)
    return point_id


def find_near_duplicate(
    organization_id: str,
    embedding: list[float],
    similarity_threshold: float = 0.95,
) -> dict | None:
    """
    Search for an existing point with very high similarity (≥ threshold).
    Returns the best match dict if above threshold, else None.
    """
    results = _get_client().query_points(
        settings.qdrant_collection,
        query=embedding,
        using=DENSE_VECTOR,
        query_filter=_org_filter(organization_id),
        limit=1,
        with_payload=True,
    ).points

    if not results:
        return None

    point = results[0]
    score = max(0.0, point.score)

    if score >= similarity_threshold:
        payload = point.payload or {}
        return {
            "uuid": str(point.id),
            "content": payload.get("content", ""),
            "document_id": payload.get("document_id", ""),
            "document_title": payload.get("document_title", ""),
            "score": round(score, 4),
        }

    return None


def delete_by_uuid(uuid_str: str) -> None:
    """Delete a single point by its UUID."""
    _get_client().delete(
        settings.qdrant_collection,
        points_selector=models.PointIdsList(points=[uuid_str]),
        wait=True,
    )
    logger.info("Deleted Qdrant point %s", uuid_str)


def delete_by_document_id(organization_id: str, document_id: str) -> int:
    """Delete all points with a specific document_id within an org.
    Used to remove approved answers from Qdrant when un-approved."""
    return delete_document(organization_id, document_id)


# --------------------------------------------------------------------------- #
# Search
# --------------------------------------------------------------------------- #

def search(
    organization_id: str,
    query_embedding: list[float],
    limit: int = 5,
) -> list[dict]:
    """
    Vector similarity search filtered by organization_id.

    Returns list of dicts with keys:
      content, document_id, chunk_id, section, document_title, score
    """
    points = _get_client().query_points(
        settings.qdrant_collection,
        query=query_embedding,
        using=DENSE_VECTOR,
        query_filter=_org_filter(organization_id),
        limit=limit,
        with_payload=True,
    ).points

    return _format_results([(p, max(0.0, p.score)) for p in points])


def hybrid_search(
    organization_id: str,
    query_text: str,
    query_embedding: list[float],
    limit: int = 5,
) -> list[dict]:
    """
    Combined vector + keyword (BM25) search filtered by organization_id.

    Runs both searches in one round trip, min-max normalises each result set
    to 0..1 and blends them with HYBRID_ALPHA (relative score fusion).
    """
    org_filter = _org_filter(organization_id)
    # Fetch extra results to account for duplicates that will be filtered out
    fetch = limit * 2

    dense, sparse = _get_client().query_batch_points(
        settings.qdrant_collection,
        requests=[
            models.QueryRequest(
                query=query_embedding, using=DENSE_VECTOR,
                filter=org_filter, limit=fetch, with_payload=True,
            ),
            models.QueryRequest(
                query=models.Document(text=query_text, model=BM25_MODEL), using=SPARSE_VECTOR,
                filter=org_filter, limit=fetch, with_payload=True,
            ),
        ],
    )

    fused: dict[str, list] = {}  # point id -> [point, fused score]
    for points, weight in ((dense.points, HYBRID_ALPHA), (sparse.points, 1.0 - HYBRID_ALPHA)):
        for point, normalised in zip(points, _normalise([p.score for p in points])):
            entry = fused.setdefault(str(point.id), [point, 0.0])
            entry[1] += weight * normalised

    ranked = sorted(fused.values(), key=lambda e: e[1], reverse=True)
    deduplicated = _format_results([(point, score) for point, score in ranked])
    return deduplicated[:limit]


def _normalise(scores: list[float]) -> list[float]:
    """Min-max normalise scores to 0..1; a single or uniform set maps to 1.0."""
    if not scores:
        return []
    low, high = min(scores), max(scores)
    if high == low:
        return [1.0] * len(scores)
    return [(s - low) / (high - low) for s in scores]


def _format_results(scored: list[tuple[Any, float]]) -> list[dict]:
    """Convert (point, score) pairs to plain dicts, deduplicating by content."""
    formatted: list[dict] = []
    seen_content: set[str] = set()
    for point, score in scored:
        payload = point.payload or {}
        content = payload.get("content", "")

        # Skip duplicate chunks (same content from the same or different chunks)
        content_key = content.strip().lower()
        if content_key in seen_content:
            continue
        seen_content.add(content_key)

        formatted.append({
            "content": content,
            "document_id": payload.get("document_id", ""),
            "chunk_id": str(point.id),
            "section": payload.get("section", ""),
            "document_title": payload.get("document_title", ""),
            "score": round(min(1.0, max(0.0, score)), 4),
        })
    return formatted


# --------------------------------------------------------------------------- #
# Knowledge base inspection
# --------------------------------------------------------------------------- #

def list_chunks(
    organization_id: str,
    chunk_index: int | None = None,
    with_vectors: bool = False,
) -> list[dict]:
    """
    Return every chunk for an organisation (optionally only one chunk_index).

    Each dict has: chunk_id, document_id, document_title, chunk_index,
    created_at (aware datetime or None) and, if requested, vector.
    """
    extra = {} if chunk_index is None else {"chunk_index": chunk_index}
    org_filter = _org_filter(organization_id, **extra)
    client = _get_client()

    chunks: list[dict] = []
    offset = None
    while True:
        points, offset = client.scroll(
            settings.qdrant_collection,
            scroll_filter=org_filter,
            limit=SCROLL_PAGE_SIZE,
            offset=offset,
            with_payload=True,
            with_vectors=[DENSE_VECTOR] if with_vectors else False,
        )
        for point in points:
            payload = point.payload or {}
            created_at = payload.get("created_at")
            chunk = {
                "chunk_id": str(point.id),
                "document_id": payload.get("document_id", ""),
                "document_title": payload.get("document_title", ""),
                "chunk_index": payload.get("chunk_index"),
                "created_at": datetime.fromtimestamp(created_at, tz=timezone.utc) if created_at else None,
            }
            if with_vectors:
                chunk["vector"] = (point.vector or {}).get(DENSE_VECTOR, [])
            chunks.append(chunk)
        if offset is None:
            return chunks


def search_first_chunks(
    organization_id: str,
    query_embedding: list[float],
    limit: int = 10,
) -> list[dict]:
    """
    Vector search over the first chunk (chunk_index=0) of each document.
    Unlike search(), results are not deduplicated by content, so identical
    documents still match each other.

    Returns list of dicts with: document_id, document_title, score.
    """
    points = _get_client().query_points(
        settings.qdrant_collection,
        query=query_embedding,
        using=DENSE_VECTOR,
        query_filter=_org_filter(organization_id, chunk_index=0),
        limit=limit,
        with_payload=True,
    ).points

    return [
        {
            "document_id": (p.payload or {}).get("document_id", ""),
            "document_title": (p.payload or {}).get("document_title", ""),
            "score": max(0.0, p.score),
        }
        for p in points
    ]


# --------------------------------------------------------------------------- #
# Delete
# --------------------------------------------------------------------------- #

def delete_document(organization_id: str, document_id: str) -> int:
    """
    Delete all chunks belonging to a specific document within an organisation.

    Returns the number of points deleted.
    """
    client = _get_client()
    doc_filter = _org_filter(organization_id, document_id=document_id)

    deleted = client.count(settings.qdrant_collection, count_filter=doc_filter, exact=True).count
    client.delete(
        settings.qdrant_collection,
        points_selector=models.FilterSelector(filter=doc_filter),
        wait=True,
    )
    logger.info(
        "Deleted %d chunks for document %s (org=%s)",
        deleted, document_id, organization_id,
    )
    return deleted
