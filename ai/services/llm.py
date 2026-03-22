"""
Groq LLM client for answer generation and question extraction.
"""

import json
import logging
import time

from groq import Groq, RateLimitError

from config import settings

logger = logging.getLogger(__name__)

_MODEL = "llama-3.3-70b-versatile"
_FALLBACK_MODEL = "llama-3.1-8b-instant"
_MAX_RETRIES = 3


def _get_client() -> Groq:
    return Groq(api_key=settings.groq_api_key)


def _call_groq(messages: list[dict], temperature: float = 0.3, max_tokens: int = 4096) -> str:
    """
    Send a chat completion request to Groq with retry and model fallback.
    """
    client = _get_client()

    for attempt in range(_MAX_RETRIES):
        model = _MODEL if attempt < 2 else _FALLBACK_MODEL
        try:
            response = client.chat.completions.create(
                model=model,
                messages=messages,
                temperature=temperature,
                max_tokens=max_tokens,
            )
            return response.choices[0].message.content or ""
        except RateLimitError as exc:
            wait = 2 ** attempt
            logger.warning("Groq rate limited (attempt %d/%d, model=%s), waiting %ds: %s",
                           attempt + 1, _MAX_RETRIES, model, wait, exc)
            time.sleep(wait)
        except Exception as exc:
            logger.error("Groq API error (model=%s): %s", model, exc)
            if attempt == _MAX_RETRIES - 1:
                raise
            time.sleep(1)

    raise RuntimeError("Exceeded maximum retries for Groq LLM call")


# --------------------------------------------------------------------------- #
# Answer generation
# --------------------------------------------------------------------------- #

_ANSWER_SYSTEM_PROMPT = """You are an expert RFP response writer for enterprise sales teams.

RULES:
1. Answer the question using ONLY the provided context passages. Do NOT use external knowledge.
2. If the context does not contain enough information, say so explicitly.
3. Write in a professional, clear, and concise tone suitable for formal proposals.
4. Cite your sources by referencing the passage numbers (e.g., [Source 1], [Source 2]).
5. Structure your answer with clear paragraphs. Use bullet points where appropriate.
6. Do NOT fabricate information. Accuracy is critical."""


def generate_answer(
    question: str,
    context_passages: list[dict],
    system_prompt: str | None = None,
) -> str:
    """
    Generate an answer to *question* grounded in *context_passages*.

    Each passage dict should have at least a "content" key.
    """
    context_block = _build_context_block(context_passages)

    messages = [
        {"role": "system", "content": system_prompt or _ANSWER_SYSTEM_PROMPT},
        {"role": "user", "content": (
            f"CONTEXT PASSAGES:\n{context_block}\n\n"
            f"QUESTION:\n{question}\n\n"
            "Please provide a comprehensive, well-cited answer."
        )},
    ]

    return _call_groq(messages)


def _build_context_block(passages: list[dict]) -> str:
    parts: list[str] = []
    for i, p in enumerate(passages, 1):
        title = p.get("document_title", "Unknown")
        section = p.get("section", "")
        content = p.get("content", "")
        header = f"[Source {i}] — {title}"
        if section:
            header += f" / {section}"
        parts.append(f"{header}\n{content}")
    return "\n\n---\n\n".join(parts)


# --------------------------------------------------------------------------- #
# Question extraction
# --------------------------------------------------------------------------- #

_EXTRACT_SYSTEM_PROMPT = """You are an expert at analysing RFP (Request for Proposal) documents.

Your task: extract every individual question, requirement, or item that needs a written response.

For each item output a JSON object with these fields:
- question_text (string): the full text of the question or requirement
- section (string or null): the section header it falls under
- question_number (integer or null): the question/item number if present
- is_mandatory (boolean): true if explicitly marked mandatory/required, else true by default
- word_limit (integer or null): word limit if specified

Return a JSON array of these objects. Output ONLY valid JSON — no markdown fences, no explanation."""


def extract_questions(document_text: str) -> list[dict]:
    """
    Send the full document text to the LLM and extract structured questions.
    """
    # Truncate very long documents to stay within context limits
    max_chars = 60_000
    truncated = document_text[:max_chars]

    messages = [
        {"role": "system", "content": _EXTRACT_SYSTEM_PROMPT},
        {"role": "user", "content": truncated},
    ]

    raw = _call_groq(messages, temperature=0.1, max_tokens=8192)

    # Parse the JSON response, handling markdown fences if present
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[-1]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3].strip()

    try:
        questions = json.loads(cleaned)
        if not isinstance(questions, list):
            questions = [questions]
        return questions
    except json.JSONDecodeError as exc:
        logger.error("Failed to parse LLM question extraction output: %s\nRaw: %s", exc, raw[:500])
        return []


# --------------------------------------------------------------------------- #
# Chat response
# --------------------------------------------------------------------------- #

_CHAT_SYSTEM_PROMPT = """You are a knowledgeable AI assistant for an enterprise RFP team.

RULES:
1. Answer using ONLY the provided context passages. Do NOT use external knowledge.
2. If the context does not contain enough information, say so clearly.
3. Cite your sources (e.g., [Source 1]).
4. Be conversational but professional.
5. Do NOT fabricate information."""


def chat_response(
    message: str,
    context_passages: list[dict],
    chat_history: list[dict] | None = None,
) -> str:
    """
    Generate a chat response grounded in context, with optional history.
    """
    context_block = _build_context_block(context_passages)

    messages: list[dict] = [
        {"role": "system", "content": _CHAT_SYSTEM_PROMPT},
    ]

    # Include previous conversation turns
    if chat_history:
        for msg in chat_history[-10:]:  # keep last 10 turns to stay within limits
            role = msg.get("role", "user")
            if role in ("user", "assistant"):
                messages.append({"role": role, "content": msg["content"]})

    messages.append({
        "role": "user",
        "content": (
            f"CONTEXT PASSAGES:\n{context_block}\n\n"
            f"USER MESSAGE:\n{message}"
        ),
    })

    return _call_groq(messages)


# --------------------------------------------------------------------------- #
# Review Agent
# --------------------------------------------------------------------------- #

_REVIEW_SYSTEM_PROMPT = """You are an expert RFP quality reviewer for enterprise sales teams.

Your task: evaluate each drafted RFP answer for quality across these dimensions:
- Accuracy: Are claims supported by the cited sources? Are there unsupported statements?
- Completeness: Does the answer address all aspects of the question?
- Tone: Is it professional, confident, and appropriate for a formal proposal?
- Clarity and Specificity: Is the answer clear, specific, and free of vague language?

For each answer, provide:
- question_id (string): the ID of the question being reviewed
- comment (string): a concise review summarising strengths and weaknesses
- suggested_edit (string or null): a specific rewrite suggestion if the answer needs improvement, null if it is good
- quality_score (float 0-1): overall quality score
  - 0.9+  = excellent, ready to submit
  - 0.7-0.9 = good, minor improvements possible
  - 0.5-0.7 = needs work, significant gaps
  - <0.5  = significant issues, rewrite recommended

Return a JSON array of these objects. Output ONLY valid JSON — no markdown fences, no explanation."""


def review_answers(qa_pairs: list[dict]) -> list[dict]:
    """
    Send drafted Q&A pairs to the LLM for quality review.

    Each dict should have: question_id, question_text, draft_text.
    Returns a list of review dicts with question_id, comment, suggested_edit, quality_score.
    """
    qa_block = _build_qa_block(qa_pairs)

    messages = [
        {"role": "system", "content": _REVIEW_SYSTEM_PROMPT},
        {"role": "user", "content": (
            f"DRAFTED Q&A PAIRS:\n{qa_block}\n\n"
            "Please review each answer and return your evaluation as a JSON array."
        )},
    ]

    raw = _call_groq(messages, temperature=0.3, max_tokens=8192)
    return _parse_json_array(raw, "review")


# --------------------------------------------------------------------------- #
# Compliance Agent
# --------------------------------------------------------------------------- #

_COMPLIANCE_SYSTEM_PROMPT = """You are an enterprise compliance and risk analyst specialising in RFP responses.

Your task: review each drafted RFP answer and flag any compliance or risk issues including:
- Overpromising: claims that cannot be verified or are unrealistically broad
- Regulatory risk: statements with GDPR, HIPAA, or other regulatory implications
- SLA/Performance guarantees: unrealistic uptime, response time, or performance commitments
- Security certifications: unverified claims about SOC2, ISO 27001, or other certifications
- Binding contractual language: phrases that could create unintended legal obligations

For each flag, provide:
- question_id (string): the ID of the question being flagged
- flag_type (string): one of "warning", "violation", or "info"
  - "violation" = definite compliance issue that must be fixed
  - "warning" = potential risk that should be reviewed
  - "info" = minor observation for awareness
- description (string): clear explanation of the issue and why it is risky
- standard (string or null): the relevant standard if applicable — one of "GDPR", "SOC2", "ISO27001", "HIPAA", or "general", or null

If an answer has no compliance issues, do NOT include it in the output.

Return a JSON array of flag objects. Output ONLY valid JSON — no markdown fences, no explanation.
If there are no flags at all, return an empty array: []"""


def check_compliance(qa_pairs: list[dict]) -> list[dict]:
    """
    Send drafted Q&A pairs to the LLM for compliance checking.

    Each dict should have: question_id, question_text, draft_text.
    Returns a list of flag dicts with question_id, flag_type, description, standard.
    """
    qa_block = _build_qa_block(qa_pairs)

    messages = [
        {"role": "system", "content": _COMPLIANCE_SYSTEM_PROMPT},
        {"role": "user", "content": (
            f"DRAFTED Q&A PAIRS:\n{qa_block}\n\n"
            "Please check each answer for compliance and risk issues and return your findings as a JSON array."
        )},
    ]

    raw = _call_groq(messages, temperature=0.1, max_tokens=8192)
    return _parse_json_array(raw, "compliance")


# --------------------------------------------------------------------------- #
# Shared helpers for agents
# --------------------------------------------------------------------------- #

def _build_qa_block(qa_pairs: list[dict]) -> str:
    """Format Q&A pairs into a readable block for LLM prompts."""
    parts: list[str] = []
    for pair in qa_pairs:
        qid = pair.get("question_id", "unknown")
        question = pair.get("question_text", "")
        answer = pair.get("draft_text", "")
        parts.append(
            f"[Question ID: {qid}]\n"
            f"Question: {question}\n"
            f"Answer: {answer}"
        )
    return "\n\n---\n\n".join(parts)


def _parse_json_array(raw: str, context: str) -> list[dict]:
    """Parse a JSON array from LLM output, handling markdown fences."""
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[-1]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3].strip()

    try:
        result = json.loads(cleaned)
        if not isinstance(result, list):
            result = [result]
        return result
    except json.JSONDecodeError as exc:
        logger.error("Failed to parse LLM %s output: %s\nRaw: %s", context, exc, raw[:500])
        return []


# --------------------------------------------------------------------------- #
# Compliance coverage assessment
# --------------------------------------------------------------------------- #

_COMPLIANCE_COVERAGE_SYSTEM_PROMPT = """You are a compliance analyst. Given a compliance requirement and retrieved knowledge base content, assess coverage.

Requirement: {requirement}
Evidence: {evidence}

Return JSON: {{"coverage_status": "covered|partial|gap", "confidence": 0.0-1.0, "evidence_summary": "brief summary"}}
Do not output markdown fences."""


async def assess_compliance_coverage(requirement: str, evidence: str) -> dict:
    """
    Assess how well the provided evidence covers a specific compliance requirement.

    Returns a dict with coverage_status, confidence, and evidence_summary.
    """
    prompt = _COMPLIANCE_COVERAGE_SYSTEM_PROMPT.format(
        requirement=requirement,
        evidence=evidence,
    )

    messages = [
        {"role": "system", "content": prompt},
        {"role": "user", "content": (
            f"Assess whether the following evidence adequately covers this compliance requirement.\n\n"
            f"Requirement: {requirement}\n\n"
            f"Evidence:\n{evidence}"
        )},
    ]

    raw = _call_groq(messages, temperature=0.1, max_tokens=1024)

    # Parse the JSON response
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[-1]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3].strip()

    try:
        result = json.loads(cleaned)
        if not isinstance(result, dict):
            logger.error("Compliance assessment returned non-dict: %s", raw[:300])
            return {"coverage_status": "gap", "confidence": 0.0, "evidence_summary": ""}
        return result
    except json.JSONDecodeError as exc:
        logger.error("Failed to parse compliance assessment JSON: %s\nRaw: %s", exc, raw[:300])
        return {"coverage_status": "gap", "confidence": 0.0, "evidence_summary": ""}


# --------------------------------------------------------------------------- #
# Document tag extraction
# --------------------------------------------------------------------------- #

_TAG_EXTRACTION_SYSTEM_PROMPT = """You are a document classification expert.

Analyse the following document excerpt and return a JSON object with:
- tags (array of strings): 5-10 descriptive keywords/phrases for the document content
- industry (string or null): the primary industry (e.g., "Healthcare", "Manufacturing", "Finance", "Technology", "Government", "Logistics")
- doc_type (string or null): the document type (e.g., "RFP", "Case Study", "Technical Spec", "Policy", "Proposal", "Contract", "White Paper")
- domain (string or null): the primary business domain (e.g., "IT Infrastructure", "Cybersecurity", "Cloud Services", "Consulting", "Supply Chain")

Output ONLY valid JSON — no markdown fences, no explanation."""


def extract_document_tags(text_sample: str) -> dict:
    """
    Use the LLM to classify a document excerpt and extract tags,
    industry, document type, and domain.
    """
    messages = [
        {"role": "system", "content": _TAG_EXTRACTION_SYSTEM_PROMPT},
        {"role": "user", "content": text_sample},
    ]

    raw = _call_groq(messages, temperature=0.1, max_tokens=1024)

    # Parse the JSON response, handling markdown fences if present
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[-1]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3].strip()

    try:
        result = json.loads(cleaned)
        return {
            "tags": result.get("tags", []),
            "industry": result.get("industry"),
            "doc_type": result.get("doc_type"),
            "domain": result.get("domain"),
        }
    except json.JSONDecodeError as exc:
        logger.error("Failed to parse LLM tag extraction output: %s\nRaw: %s", exc, raw[:500])
        return {"tags": [], "industry": None, "doc_type": None, "domain": None}


# --------------------------------------------------------------------------- #
# Risk assessment for RFP gaps
# --------------------------------------------------------------------------- #

_RISK_ASSESSMENT_SYSTEM_PROMPT = """You are an expert RFP risk analyst for enterprise sales teams.

You will receive a list of RFP requirements that the organisation's knowledge base does NOT adequately cover (capability gaps).

For each requirement, assess the risk of not being able to respond effectively:
- risk_level: "high", "medium", or "low"
  - high: critical requirement, likely a deal-breaker if not addressed
  - medium: important but could be mitigated with additional effort
  - low: minor gap, unlikely to significantly impact the bid
- explanation: brief (1-2 sentences) reason for the risk level

Return a JSON array of objects, each with:
- requirement (string): the original requirement text
- risk_level (string): "high", "medium", or "low"
- explanation (string): reason for the assessment

Output ONLY valid JSON — no markdown fences, no explanation."""


def assess_requirement_risks(gaps: list[dict]) -> list[dict]:
    """
    Use the LLM to assess the risk level of uncovered RFP requirements.

    Each gap dict should have at least a "requirement" key.
    Returns a list of dicts with: requirement, risk_level, explanation.
    """
    if not gaps:
        return []

    # Build the gap descriptions for the LLM
    gap_texts = []
    for i, g in enumerate(gaps, 1):
        gap_texts.append(f"{i}. {g['requirement']}")
    gap_block = "\n".join(gap_texts)

    messages = [
        {"role": "system", "content": _RISK_ASSESSMENT_SYSTEM_PROMPT},
        {"role": "user", "content": f"UNCOVERED REQUIREMENTS:\n{gap_block}"},
    ]

    raw = _call_groq(messages, temperature=0.2, max_tokens=4096)

    # Parse the JSON response
    cleaned = raw.strip()
    if cleaned.startswith("```"):
        cleaned = cleaned.split("\n", 1)[-1]
        if cleaned.endswith("```"):
            cleaned = cleaned[:-3].strip()

    try:
        result = json.loads(cleaned)
        if not isinstance(result, list):
            result = [result]

        # Validate and normalise each entry
        validated: list[dict] = []
        for item in result:
            validated.append({
                "requirement": item.get("requirement", ""),
                "risk_level": item.get("risk_level", "medium"),
                "explanation": item.get("explanation", ""),
            })
        return validated

    except json.JSONDecodeError as exc:
        logger.error("Failed to parse LLM risk assessment output: %s\nRaw: %s", exc, raw[:500])
        # Fallback: return all gaps as medium risk
        return [
            {
                "requirement": g["requirement"],
                "risk_level": "medium",
                "explanation": "Risk assessment could not be parsed from LLM response.",
            }
            for g in gaps
        ]
