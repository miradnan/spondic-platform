"""
POST /rfp/compliance-matrix — Generate a compliance matrix for a project.
"""

import logging

from fastapi import APIRouter, HTTPException

from models import ComplianceMatrixRequest, ComplianceMatrixResponse
from services.compliance import generate_compliance_matrix, COMPLIANCE_STANDARDS

logger = logging.getLogger(__name__)

router = APIRouter()


@router.post("/rfp/compliance-matrix", response_model=ComplianceMatrixResponse)
async def compliance_matrix(request: ComplianceMatrixRequest):
    """
    Evaluate the organization's knowledge base against a compliance standard
    and return a matrix showing coverage, partial coverage, and gaps.
    """
    if request.standard not in COMPLIANCE_STANDARDS:
        raise HTTPException(
            status_code=400,
            detail=f"Unsupported standard: {request.standard}. Supported: {', '.join(COMPLIANCE_STANDARDS.keys())}",
        )

    try:
        result = await generate_compliance_matrix(
            organization_id=request.organization_id,
            project_id=request.project_id,
            standard=request.standard,
        )
        return result
    except Exception as exc:
        logger.error(
            "Compliance matrix generation failed for project %s (standard=%s): %s",
            request.project_id, request.standard, exc,
        )
        raise HTTPException(status_code=500, detail=str(exc))
