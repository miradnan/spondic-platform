"""
Go/No-Go RFP scoring service.

Evaluates an RFP document against the organisation's knowledge base to
produce a coverage score, identify capability gaps, and assess risk areas.
All operations enforce multi-tenant isolation via organization_id.
"""

import logging
import os

from services import embedder, llm, parser, s3, vectorstore

logger = logging.getLogger(__name__)


async def score_rfp(
    organization_id: str,
    document_id: str,
    s3_key: str,
) -> dict:
    """
    Score an RFP by evaluating knowledge base coverage for each requirement.

    Pipeline:
      1. Download and parse the RFP document
      2. Extract requirements using the LLM
      3. For each requirement, search the KB with hybrid_search
      4. Score coverage: high (>0.6), medium (0.3-0.6), low (<0.3)
      5. Identify gaps (requirements with low coverage)
      6. Use LLM to assess risk level of gaps
      7. Calculate go_score = (covered / total) * 100
      8. Recommendation: go (>70), conditional (50-70), no-go (<50)

    Returns dict matching ScoreResponse model.
    """
    logger.info("Scoring RFP %s (org=%s, key=%s)", document_id, organization_id, s3_key)

    # 1. Download and parse
    local_path = s3.download_file(s3_key)

    try:
        text = parser.parse_document(local_path)
        if not text.strip():
            logger.warning("RFP document is empty: %s", s3_key)
            return _empty_score_response()

        # 2. Extract requirements using the same LLM extraction as parse_rfp
        requirements = llm.extract_questions(text)
        if not requirements:
            logger.warning("No requirements extracted from RFP %s", document_id)
            return _empty_score_response()

        total_requirements = len(requirements)
        covered_count = 0
        capability_gaps: list[dict] = []
        gap_details_for_risk: list[dict] = []

        # 3. For each requirement, search KB
        for req in requirements:
            question_text = req.get("question_text", "")
            if not question_text:
                continue

            try:
                query_embedding = embedder.embed_single(question_text)
                search_results = vectorstore.hybrid_search(
                    organization_id=organization_id,
                    query_text=question_text,
                    query_embedding=query_embedding,
                    limit=5,
                )

                # 4. Score coverage based on best match score
                if search_results:
                    best_score = max(r["score"] for r in search_results)
                else:
                    best_score = 0.0

                if best_score > 0.6:
                    # High coverage — requirement is covered
                    covered_count += 1
                elif best_score > 0.3:
                    # Medium coverage — partially covered, counts as covered
                    covered_count += 1
                else:
                    # Low coverage — gap identified
                    gap_desc = (
                        f"No sufficient knowledge base content found "
                        f"(best match score: {best_score:.2f})"
                    )
                    capability_gaps.append({
                        "requirement": question_text,
                        "gap_description": gap_desc,
                    })
                    gap_details_for_risk.append({
                        "requirement": question_text,
                        "best_score": best_score,
                        "section": req.get("section", ""),
                    })

            except Exception as exc:
                logger.error("Failed to score requirement: %s — %s", question_text[:80], exc)
                capability_gaps.append({
                    "requirement": question_text,
                    "gap_description": f"Error during evaluation: {exc}",
                })

        # 5. Assess risk of gaps using LLM
        risk_areas: list[dict] = []
        if gap_details_for_risk:
            try:
                risk_areas = llm.assess_requirement_risks(gap_details_for_risk)
            except Exception as exc:
                logger.error("Risk assessment failed: %s", exc)
                # Fallback: create basic risk entries
                risk_areas = [
                    {
                        "requirement": g["requirement"],
                        "risk_level": "medium",
                        "explanation": "Risk assessment unavailable due to an error.",
                    }
                    for g in gap_details_for_risk
                ]

        # 6. Calculate go score
        if total_requirements > 0:
            go_score = round((covered_count / total_requirements) * 100, 1)
        else:
            go_score = 0.0

        # 7. Determine recommendation
        if go_score > 70:
            recommendation = "go"
        elif go_score >= 50:
            recommendation = "conditional"
        else:
            recommendation = "no-go"

        logger.info(
            "RFP %s scored: %.1f%% (%d/%d covered) — %s",
            document_id, go_score, covered_count, total_requirements, recommendation,
        )

        return {
            "go_score": go_score,
            "risk_areas": risk_areas,
            "capability_gaps": capability_gaps,
            "recommendation": recommendation,
            "total_requirements": total_requirements,
            "covered_requirements": covered_count,
        }

    finally:
        try:
            os.unlink(local_path)
        except OSError:
            pass


def _empty_score_response() -> dict:
    """Return a default empty score response for edge cases."""
    return {
        "go_score": 0.0,
        "risk_areas": [],
        "capability_gaps": [],
        "recommendation": "no-go",
        "total_requirements": 0,
        "covered_requirements": 0,
    }
