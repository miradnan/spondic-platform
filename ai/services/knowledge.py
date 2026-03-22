"""
Knowledge Base management service.

Provides auto-tagging, stale document detection, duplicate detection,
and freshness reporting for the organisation's document knowledge base.
All operations enforce multi-tenant isolation via organization_id.
"""

import logging
import os
from datetime import datetime, timezone

from services import llm, parser, s3, vectorstore
from weaviate.classes.query import Filter, MetadataQuery

logger = logging.getLogger(__name__)


# --------------------------------------------------------------------------- #
# Auto-tagging
# --------------------------------------------------------------------------- #

async def auto_tag_document(
    organization_id: str,
    document_id: str,
    s3_key: str,
) -> dict:
    """
    Download a document, parse it, and use the LLM to extract tags,
    industry, document type, and domain classification.

    Returns dict with keys: tags, industry, doc_type, domain.
    """
    logger.info(
        "Auto-tagging document %s (org=%s, key=%s)",
        document_id, organization_id, s3_key,
    )

    local_path = s3.download_file(s3_key)

    try:
        text = parser.parse_document(local_path)
        if not text.strip():
            logger.warning("Document is empty, cannot auto-tag: %s", s3_key)
            return {"tags": [], "industry": None, "doc_type": None, "domain": None}

        # Take first ~2000 tokens as sample (approx 8000 chars)
        sample = text[:8000]

        result = llm.extract_document_tags(sample)
        logger.info("Auto-tagged document %s: %s", document_id, result)
        return result

    finally:
        try:
            os.unlink(local_path)
        except OSError:
            pass


# --------------------------------------------------------------------------- #
# Stale document detection
# --------------------------------------------------------------------------- #

async def detect_stale_documents(
    organization_id: str,
    threshold_days: int = 90,
) -> list[dict]:
    """
    Query Weaviate for all documents in the organisation and identify those
    older than *threshold_days*.

    Returns a list of dicts with: document_id, document_title, chunk_count, days_old.
    """
    logger.info("Detecting stale documents (org=%s, threshold=%d days)", organization_id, threshold_days)

    collection = vectorstore._get_collection()

    # Fetch all chunks for this org with creation timestamps
    all_objects = collection.query.fetch_objects(
        filters=Filter.by_property("organization_id").equal(organization_id),
        limit=10000,
        return_metadata=MetadataQuery(creation_time=True),
    )

    if not all_objects.objects:
        logger.info("No documents found for org=%s", organization_id)
        return []

    # Group by document_id
    doc_map: dict[str, dict] = {}
    now = datetime.now(timezone.utc)

    for obj in all_objects.objects:
        props = obj.properties
        doc_id = props.get("document_id", "")
        doc_title = props.get("document_title", "")
        creation_time = getattr(obj.metadata, "creation_time", None)

        if doc_id not in doc_map:
            doc_map[doc_id] = {
                "document_id": doc_id,
                "document_title": doc_title,
                "chunk_count": 0,
                "oldest_creation": creation_time,
            }

        doc_map[doc_id]["chunk_count"] += 1

        # Track the oldest chunk creation time for the document
        if creation_time and (
            doc_map[doc_id]["oldest_creation"] is None
            or creation_time < doc_map[doc_id]["oldest_creation"]
        ):
            doc_map[doc_id]["oldest_creation"] = creation_time

    # Filter to stale documents
    stale: list[dict] = []
    for doc in doc_map.values():
        creation = doc["oldest_creation"]
        if creation is None:
            continue

        days_old = (now - creation).days
        if days_old >= threshold_days:
            stale.append({
                "document_id": doc["document_id"],
                "document_title": doc["document_title"],
                "chunk_count": doc["chunk_count"],
                "days_old": days_old,
            })

    # Sort by days_old descending (oldest first)
    stale.sort(key=lambda d: d["days_old"], reverse=True)

    logger.info("Found %d stale documents for org=%s", len(stale), organization_id)
    return stale


# --------------------------------------------------------------------------- #
# Duplicate detection
# --------------------------------------------------------------------------- #

async def detect_duplicates(
    organization_id: str,
    similarity_threshold: float = 0.92,
) -> list[dict]:
    """
    Detect near-duplicate documents by comparing first-chunk embeddings.

    Returns a list of duplicate groups, each with:
      document_ids, document_titles, similarity_score.
    """
    logger.info("Detecting duplicates (org=%s, threshold=%.2f)", organization_id, similarity_threshold)

    collection = vectorstore._get_collection()

    # Fetch all chunks for this org that are chunk_index=0 (first chunk of each doc)
    all_objects = collection.query.fetch_objects(
        filters=(
            Filter.by_property("organization_id").equal(organization_id)
            & Filter.by_property("chunk_index").equal(0)
        ),
        limit=10000,
        include_vector=True,
    )

    if not all_objects.objects:
        logger.info("No documents found for org=%s", organization_id)
        return []

    # Build list of (doc_id, doc_title, vector)
    docs: list[dict] = []
    seen_doc_ids: set[str] = set()
    for obj in all_objects.objects:
        props = obj.properties
        doc_id = props.get("document_id", "")
        if doc_id in seen_doc_ids:
            continue
        seen_doc_ids.add(doc_id)

        vector = obj.vector
        # Weaviate v4 may return vector as dict with 'default' key
        if isinstance(vector, dict):
            vector = vector.get("default", [])

        if not vector:
            continue

        docs.append({
            "document_id": doc_id,
            "document_title": props.get("document_title", ""),
            "vector": vector,
        })

    if len(docs) < 2:
        return []

    # Compare each pair of documents
    already_grouped: set[str] = set()
    groups: list[dict] = []

    for i, doc_a in enumerate(docs):
        if doc_a["document_id"] in already_grouped:
            continue

        # Search for similar documents using doc_a's vector
        results = collection.query.near_vector(
            near_vector=doc_a["vector"],
            limit=10,
            filters=(
                Filter.by_property("organization_id").equal(organization_id)
                & Filter.by_property("chunk_index").equal(0)
            ),
            return_metadata=MetadataQuery(distance=True),
        )

        group_ids: list[str] = [doc_a["document_id"]]
        group_titles: list[str] = [doc_a["document_title"]]
        best_similarity = 0.0

        for obj in results.objects:
            other_doc_id = obj.properties.get("document_id", "")
            if other_doc_id == doc_a["document_id"]:
                continue
            if other_doc_id in already_grouped:
                continue

            distance = getattr(obj.metadata, "distance", None) or 0.0
            similarity = max(0.0, 1.0 - distance)

            if similarity >= similarity_threshold:
                group_ids.append(other_doc_id)
                group_titles.append(obj.properties.get("document_title", ""))
                best_similarity = max(best_similarity, similarity)

        if len(group_ids) > 1:
            for gid in group_ids:
                already_grouped.add(gid)
            groups.append({
                "document_ids": group_ids,
                "document_titles": group_titles,
                "similarity_score": round(best_similarity, 4),
            })

    logger.info("Found %d duplicate groups for org=%s", len(groups), organization_id)
    return groups


# --------------------------------------------------------------------------- #
# Freshness report
# --------------------------------------------------------------------------- #

async def freshness_report(
    organization_id: str,
    max_fresh_days: int = 180,
) -> list[dict]:
    """
    Generate a freshness report for all documents in the organisation.

    freshness_score = max(0, 1 - (days_old / max_fresh_days))

    Returns a list sorted by freshness (stalest first), each with:
      document_id, document_title, chunk_count, freshness_score, is_stale.
    """
    logger.info("Generating freshness report (org=%s, max_fresh_days=%d)", organization_id, max_fresh_days)

    collection = vectorstore._get_collection()

    all_objects = collection.query.fetch_objects(
        filters=Filter.by_property("organization_id").equal(organization_id),
        limit=10000,
        return_metadata=MetadataQuery(creation_time=True),
    )

    if not all_objects.objects:
        logger.info("No documents found for org=%s", organization_id)
        return []

    # Group by document_id
    doc_map: dict[str, dict] = {}
    now = datetime.now(timezone.utc)

    for obj in all_objects.objects:
        props = obj.properties
        doc_id = props.get("document_id", "")
        doc_title = props.get("document_title", "")
        creation_time = getattr(obj.metadata, "creation_time", None)

        if doc_id not in doc_map:
            doc_map[doc_id] = {
                "document_id": doc_id,
                "document_title": doc_title,
                "chunk_count": 0,
                "oldest_creation": creation_time,
            }

        doc_map[doc_id]["chunk_count"] += 1

        if creation_time and (
            doc_map[doc_id]["oldest_creation"] is None
            or creation_time < doc_map[doc_id]["oldest_creation"]
        ):
            doc_map[doc_id]["oldest_creation"] = creation_time

    # Calculate freshness for each document
    report: list[dict] = []
    for doc in doc_map.values():
        creation = doc["oldest_creation"]
        if creation is None:
            days_old = max_fresh_days  # treat unknown as maximally stale
        else:
            days_old = (now - creation).days

        freshness_score = max(0.0, 1.0 - (days_old / max_fresh_days))

        report.append({
            "document_id": doc["document_id"],
            "document_title": doc["document_title"],
            "chunk_count": doc["chunk_count"],
            "freshness_score": round(freshness_score, 4),
            "is_stale": freshness_score == 0.0,
        })

    # Sort by freshness score ascending (stalest first)
    report.sort(key=lambda d: d["freshness_score"])

    logger.info("Freshness report: %d documents for org=%s", len(report), organization_id)
    return report
