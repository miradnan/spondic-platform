"""
Compliance Matrix Generator.

Evaluates an organization's knowledge base against standard compliance
frameworks (SOC2, ISO27001, GDPR, HIPAA) by searching for evidence of
each requirement and using LLM assessment to classify coverage.
"""

import logging

from services.embedder import embed_single
from services.vectorstore import hybrid_search
from services.llm import assess_compliance_coverage

logger = logging.getLogger(__name__)

COMPLIANCE_STANDARDS = {
    "SOC2": {
        "name": "SOC 2 Type II",
        "categories": {
            "Security": [
                "Access controls and authentication mechanisms",
                "Network security and firewall configurations",
                "Encryption at rest and in transit",
                "Vulnerability management and patching",
                "Incident response procedures",
                "Security awareness training",
            ],
            "Availability": [
                "System uptime SLA commitments",
                "Disaster recovery and business continuity",
                "Backup and restoration procedures",
                "Infrastructure redundancy",
            ],
            "Processing Integrity": [
                "Data validation and quality controls",
                "Error handling and monitoring",
                "Change management procedures",
            ],
            "Confidentiality": [
                "Data classification policies",
                "Access restrictions to confidential data",
                "Confidentiality agreements",
                "Data retention and disposal",
            ],
            "Privacy": [
                "Personal data collection practices",
                "Consent management",
                "Data subject rights",
                "Privacy impact assessments",
            ],
        },
    },
    "ISO27001": {
        "name": "ISO 27001:2022",
        "categories": {
            "Organizational Controls": [
                "Information security policies",
                "Roles and responsibilities",
                "Segregation of duties",
                "Threat intelligence",
            ],
            "People Controls": [
                "Screening and background checks",
                "Security awareness training",
                "Disciplinary process",
            ],
            "Physical Controls": [
                "Physical security perimeters",
                "Physical entry controls",
                "Equipment maintenance",
            ],
            "Technological Controls": [
                "Privileged access management",
                "Secure authentication",
                "Malware protection",
                "Vulnerability management",
                "Network security",
                "Cryptography",
                "Secure development lifecycle",
                "Data leakage prevention",
            ],
        },
    },
    "GDPR": {
        "name": "General Data Protection Regulation",
        "categories": {
            "Lawfulness": [
                "Legal basis for processing",
                "Consent mechanisms",
                "Legitimate interest assessments",
            ],
            "Data Subject Rights": [
                "Right of access",
                "Right to rectification",
                "Right to erasure",
                "Right to data portability",
                "Right to object",
            ],
            "Data Protection": [
                "Data protection by design and default",
                "Data protection impact assessments",
                "Records of processing activities",
                "Data breach notification procedures",
            ],
            "International Transfers": [
                "Cross-border data transfer mechanisms",
                "Standard contractual clauses",
                "Data residency commitments",
            ],
            "Governance": [
                "Data Protection Officer",
                "Data processing agreements",
                "Sub-processor management",
            ],
        },
    },
    "HIPAA": {
        "name": "HIPAA",
        "categories": {
            "Administrative Safeguards": [
                "Risk analysis and management",
                "Assigned security responsibility",
                "Workforce security",
                "Security awareness training",
                "Security incident procedures",
                "Contingency planning",
                "Business associate agreements",
            ],
            "Physical Safeguards": [
                "Facility access controls",
                "Workstation security",
                "Device and media controls",
            ],
            "Technical Safeguards": [
                "Access control and unique user IDs",
                "Audit controls and logging",
                "Integrity controls for ePHI",
                "Transmission security and encryption",
            ],
            "Breach Notification": [
                "Breach notification to individuals",
                "Breach notification to HHS",
            ],
        },
    },
}


def _flatten_requirements(standard_def: dict) -> list[dict]:
    """Flatten categories into a list of {category, requirement, requirement_id} dicts."""
    items: list[dict] = []
    req_index = 0
    for category, requirements in standard_def["categories"].items():
        for requirement in requirements:
            req_index += 1
            items.append({
                "requirement_id": f"REQ-{req_index:03d}",
                "category": category,
                "requirement": requirement,
            })
    return items


async def generate_compliance_matrix(
    organization_id: str,
    project_id: str,
    standard: str,
) -> dict:
    """
    Generate a compliance matrix by evaluating KB coverage against a standard.

    1. Get the standard definition from COMPLIANCE_STANDARDS.
    2. Flatten all requirements (category + requirement text).
    3. For each requirement:
       a. Search KB using hybrid_search.
       b. Score the best match.
       c. Use LLM to assess coverage quality.
       d. Classify: covered (>0.6), partial (0.3-0.6), gap (<0.3).
    4. Calculate overall coverage = covered / total.
    5. Return ComplianceMatrixResponse-compatible dict.
    """
    standard_def = COMPLIANCE_STANDARDS[standard]
    requirements = _flatten_requirements(standard_def)

    items: list[dict] = []
    covered_count = 0
    partial_count = 0
    gap_count = 0

    for req in requirements:
        # Search the KB for evidence related to this requirement
        query_text = req["requirement"]
        query_embedding = embed_single(query_text)

        search_results = hybrid_search(
            organization_id=organization_id,
            query_text=query_text,
            query_embedding=query_embedding,
            limit=3,
        )

        if not search_results:
            # No evidence found at all — this is a gap
            items.append({
                "requirement_id": req["requirement_id"],
                "requirement": req["requirement"],
                "category": req["category"],
                "mapped_question": None,
                "mapped_question_id": None,
                "coverage_status": "gap",
                "confidence": 0.0,
                "evidence": None,
            })
            gap_count += 1
            continue

        # Combine top search results as evidence
        best_result = search_results[0]
        evidence_texts = [r["content"] for r in search_results]
        combined_evidence = "\n\n".join(evidence_texts)

        # Use LLM to assess coverage quality
        assessment = await assess_compliance_coverage(
            requirement=req["requirement"],
            evidence=combined_evidence,
        )

        coverage_status = assessment.get("coverage_status", "gap")
        confidence = assessment.get("confidence", 0.0)
        evidence_summary = assessment.get("evidence_summary", "")

        # Validate and normalise status based on confidence thresholds
        if confidence > 0.6:
            coverage_status = "covered"
        elif confidence > 0.3:
            coverage_status = "partial"
        else:
            coverage_status = "gap"

        if coverage_status == "covered":
            covered_count += 1
        elif coverage_status == "partial":
            partial_count += 1
        else:
            gap_count += 1

        items.append({
            "requirement_id": req["requirement_id"],
            "requirement": req["requirement"],
            "category": req["category"],
            "mapped_question": best_result.get("content", "")[:200],
            "mapped_question_id": best_result.get("chunk_id"),
            "coverage_status": coverage_status,
            "confidence": round(confidence, 2),
            "evidence": evidence_summary or None,
        })

    total = len(requirements)
    overall_coverage = covered_count / total if total > 0 else 0.0

    return {
        "standard": standard_def["name"],
        "total_requirements": total,
        "covered": covered_count,
        "partial": partial_count,
        "gaps": gap_count,
        "overall_coverage": round(overall_coverage, 4),
        "items": items,
    }
