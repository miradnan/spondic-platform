"""
Multi-agent pipeline: Draft → Review → Compliance

Orchestrates the existing RAG drafting pipeline with Review and Compliance
agents that evaluate answer quality and flag compliance risks.
"""

import logging

from services import llm, rag

logger = logging.getLogger(__name__)


async def run_multi_agent_pipeline(
    organization_id: str,
    project_id: str,
    questions: list[dict],
) -> dict:
    """
    Run the full multi-agent pipeline:
      1. Draft answers via existing RAG pipeline
      2. Review Agent — evaluate quality of each answer
      3. Compliance Agent — check for risky commitments
      4. Calculate overall score from review scores

    Returns a dict with answers, review_comments, compliance_flags, overall_score.
    """
    logger.info(
        "Starting multi-agent pipeline for project %s (org=%s, %d questions)",
        project_id, organization_id, len(questions),
    )

    # Step 1: Draft answers (reuse existing RAG pipeline)
    raw_answers = await rag.draft_answers(
        organization_id=organization_id,
        questions=questions,
    )
    logger.info("Draft stage complete: %d answers generated", len(raw_answers))

    # Build Q&A pairs for the review and compliance agents
    # Map question_id back to question_text for context
    question_map = {q["id"]: q["question_text"] for q in questions}
    qa_pairs = [
        {
            "question_id": a["question_id"],
            "question_text": question_map.get(a["question_id"], ""),
            "draft_text": a["draft_text"],
        }
        for a in raw_answers
    ]

    # Step 2: Review Agent — evaluate quality
    try:
        review_comments = llm.review_answers(qa_pairs)
        logger.info("Review stage complete: %d comments", len(review_comments))
    except Exception as exc:
        logger.error("Review agent failed: %s", exc)
        review_comments = []

    # Step 3: Compliance Agent — check for risks
    try:
        compliance_flags = llm.check_compliance(qa_pairs)
        logger.info("Compliance stage complete: %d flags", len(compliance_flags))
    except Exception as exc:
        logger.error("Compliance agent failed: %s", exc)
        compliance_flags = []

    # Step 4: Calculate overall score from review scores
    if review_comments:
        scores = [
            rc.get("quality_score", 0.0)
            for rc in review_comments
            if isinstance(rc.get("quality_score"), (int, float))
        ]
        overall_score = round(sum(scores) / len(scores), 4) if scores else 0.0
    else:
        overall_score = 0.0

    logger.info("Multi-agent pipeline complete. Overall score: %.2f", overall_score)

    return {
        "answers": raw_answers,
        "review_comments": review_comments,
        "compliance_flags": compliance_flags,
        "overall_score": overall_score,
    }
