"""
Weaviate vector store service.

Manages the DocumentChunk collection: schema creation, chunk storage,
vector/hybrid search, and deletion. All searches enforce multi-tenant
isolation via organization_id filtering.

Uses weaviate-client v4 API.
"""

import logging
from typing import Any

import weaviate
from weaviate.classes.config import Configure, DataType, Property
from weaviate.classes.query import Filter, MetadataQuery
from weaviate.collections import Collection

from config import settings

logger = logging.getLogger(__name__)

COLLECTION_NAME = "DocumentChunk"

# Module-level client reference, initialised in init_client()
_client: weaviate.WeaviateClient | None = None


# --------------------------------------------------------------------------- #
# Lifecycle
# --------------------------------------------------------------------------- #

def init_client() -> None:
    """Connect to Weaviate and create the collection schema if needed."""
    global _client
    url = settings.weaviate_url
    logger.info("Connecting to Weaviate at %s", url)

    # Parse host and port from URL like "http://localhost:8081" or "http://weaviate:8080"
    stripped = url.replace("http://", "").replace("https://", "").rstrip("/")
    parts = stripped.split(":")
    host = parts[0]
    port = int(parts[1]) if len(parts) > 1 else 8080

    _client = weaviate.connect_to_custom(
        http_host=host,
        http_port=port,
        http_secure=False,
        grpc_host=host,
        grpc_port=50051,
        grpc_secure=False,
    )

    _ensure_schema()
    logger.info("Weaviate client ready")


def close_client() -> None:
    global _client
    if _client is not None:
        _client.close()
        _client = None
        logger.info("Weaviate client closed")


def _get_collection() -> Collection:
    if _client is None:
        raise RuntimeError("Weaviate client not initialised — call init_client() first")
    return _client.collections.get(COLLECTION_NAME)


def _ensure_schema() -> None:
    """Create the DocumentChunk collection if it does not already exist."""
    if _client is None:
        raise RuntimeError("Weaviate client not initialised")

    if _client.collections.exists(COLLECTION_NAME):
        logger.info("Collection '%s' already exists", COLLECTION_NAME)
        return

    logger.info("Creating collection '%s'", COLLECTION_NAME)
    _client.collections.create(
        name=COLLECTION_NAME,
        vectorizer_config=Configure.Vectorizer.none(),  # we supply external embeddings
        properties=[
            Property(name="content", data_type=DataType.TEXT),
            Property(name="organization_id", data_type=DataType.TEXT),
            Property(name="document_id", data_type=DataType.TEXT),
            Property(name="chunk_index", data_type=DataType.INT),
            Property(name="section", data_type=DataType.TEXT),
            Property(name="document_title", data_type=DataType.TEXT),
        ],
    )
    logger.info("Collection '%s' created", COLLECTION_NAME)


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
    Store document chunks with their embedding vectors in Weaviate.

    Returns a list of Weaviate object UUIDs (as strings).
    """
    collection = _get_collection()
    object_ids: list[str] = []

    with collection.batch.dynamic() as batch:
        for chunk, embedding in zip(chunks, embeddings):
            obj_uuid = batch.add_object(
                properties={
                    "content": chunk["content"],
                    "organization_id": organization_id,
                    "document_id": document_id,
                    "chunk_index": chunk["chunk_index"],
                    "section": chunk.get("section", ""),
                    "document_title": document_title,
                },
                vector=embedding,
            )
            object_ids.append(str(obj_uuid))

    logger.info(
        "Stored %d chunks for document %s (org=%s)",
        len(object_ids), document_id, organization_id,
    )
    return object_ids


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
    collection = _get_collection()

    results = collection.query.near_vector(
        near_vector=query_embedding,
        limit=limit,
        filters=Filter.by_property("organization_id").equal(organization_id),
        return_metadata=MetadataQuery(distance=True),
    )

    return _format_results(results.objects)


def hybrid_search(
    organization_id: str,
    query_text: str,
    query_embedding: list[float],
    limit: int = 5,
) -> list[dict]:
    """
    Combined vector + keyword (BM25) search filtered by organization_id.
    """
    collection = _get_collection()

    results = collection.query.hybrid(
        query=query_text,
        vector=query_embedding,
        limit=limit,
        alpha=0.7,  # 0.7 = lean toward vector, 0.3 toward keyword
        filters=Filter.by_property("organization_id").equal(organization_id),
        return_metadata=MetadataQuery(distance=True, score=True),
    )

    return _format_results(results.objects)


def _format_results(objects: list[Any]) -> list[dict]:
    """Convert Weaviate result objects to plain dicts."""
    formatted: list[dict] = []
    for obj in objects:
        props = obj.properties
        # Weaviate returns distance (lower = more similar). Convert to a
        # similarity score in [0, 1].
        distance = getattr(obj.metadata, "distance", None) or 0.0
        score = max(0.0, 1.0 - distance)

        formatted.append({
            "content": props.get("content", ""),
            "document_id": props.get("document_id", ""),
            "chunk_id": str(obj.uuid),
            "section": props.get("section", ""),
            "document_title": props.get("document_title", ""),
            "score": round(score, 4),
        })
    return formatted


# --------------------------------------------------------------------------- #
# Delete
# --------------------------------------------------------------------------- #

def delete_document(organization_id: str, document_id: str) -> int:
    """
    Delete all chunks belonging to a specific document within an organisation.

    Returns the number of objects deleted.
    """
    collection = _get_collection()

    result = collection.data.delete_many(
        where=Filter.by_property("document_id").equal(document_id)
        & Filter.by_property("organization_id").equal(organization_id),
    )

    deleted = result.successful if result else 0
    logger.info(
        "Deleted %d chunks for document %s (org=%s)",
        deleted, document_id, organization_id,
    )
    return deleted
