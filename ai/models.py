"""
Pydantic request/response models for the AI service API.
"""

from pydantic import BaseModel, Field


# --------------------------------------------------------------------------- #
# Shared: token usage
# --------------------------------------------------------------------------- #

class TokenUsageResponse(BaseModel):
    prompt_tokens: int = 0
    completion_tokens: int = 0
    total_tokens: int = 0


# --------------------------------------------------------------------------- #
# Index
# --------------------------------------------------------------------------- #

class IndexRequest(BaseModel):
    organization_id: str
    document_id: str
    s3_key: str
    title: str = ""
    source_type: str = "pdf"


class IndexResponse(BaseModel):
    success: bool
    chunks_created: int
    weaviate_object_ids: list[str]


# --------------------------------------------------------------------------- #
# Parse (RFP question extraction)
# --------------------------------------------------------------------------- #

class ExtractedQuestion(BaseModel):
    question_text: str
    section: str | None = None
    question_number: int | None = None
    is_mandatory: bool = True
    word_limit: int | None = None


class ParseRequest(BaseModel):
    organization_id: str
    document_id: str
    s3_key: str


class ParseResponse(BaseModel):
    questions: list[ExtractedQuestion]
    tokens_used: TokenUsageResponse | None = None


# --------------------------------------------------------------------------- #
# Draft
# --------------------------------------------------------------------------- #

class DraftQuestionInput(BaseModel):
    id: str
    question_text: str
    section: str | None = None


class Citation(BaseModel):
    document_id: str
    chunk_id: str
    citation_text: str
    relevance_score: float


class DraftAnswer(BaseModel):
    question_id: str
    draft_text: str
    confidence_score: float
    citations: list[Citation]


class DraftRequest(BaseModel):
    organization_id: str
    project_id: str
    questions: list[DraftQuestionInput]


class DraftResponse(BaseModel):
    answers: list[DraftAnswer]
    tokens_used: TokenUsageResponse | None = None


# --------------------------------------------------------------------------- #
# Chat
# --------------------------------------------------------------------------- #

class ChatHistoryMessage(BaseModel):
    role: str
    content: str


class ChatCitation(BaseModel):
    document_title: str
    citation_text: str
    relevance_score: float


class ChatRequest(BaseModel):
    organization_id: str
    message: str
    chat_history: list[ChatHistoryMessage] = Field(default_factory=list)


class ChatResponse(BaseModel):
    response: str
    citations: list[ChatCitation]
    tokens_used: TokenUsageResponse | None = None


# --------------------------------------------------------------------------- #
# Search
# --------------------------------------------------------------------------- #

class SearchResult(BaseModel):
    document_id: str
    chunk_id: str
    content: str
    score: float
    document_title: str


class SearchRequest(BaseModel):
    organization_id: str
    query: str
    limit: int = 10


class SearchResponse(BaseModel):
    results: list[SearchResult]


# --------------------------------------------------------------------------- #
# Index Approved Answer
# --------------------------------------------------------------------------- #

class IndexAnswerRequest(BaseModel):
    organization_id: str
    answer_id: str
    question_text: str
    answer_text: str
    project_name: str = ""
    section: str = ""

class IndexAnswerResponse(BaseModel):
    status: str = "ok"
    weaviate_object_id: str = ""
    skipped_as_duplicate: bool = False
    error: str = ""

class RemoveAnswerRequest(BaseModel):
    organization_id: str
    answer_id: str


# --------------------------------------------------------------------------- #
# Delete
# --------------------------------------------------------------------------- #

class DeleteRequest(BaseModel):
    organization_id: str
    document_id: str


# --------------------------------------------------------------------------- #
# Multi-Agent Pipeline
# --------------------------------------------------------------------------- #

class ReviewComment(BaseModel):
    question_id: str
    comment: str
    suggested_edit: str | None = None
    quality_score: float


class ComplianceFlag(BaseModel):
    question_id: str
    flag_type: str  # "warning", "violation", "info"
    description: str
    standard: str | None = None


class DraftWithReviewRequest(BaseModel):
    organization_id: str
    project_id: str
    questions: list[DraftQuestionInput]


class DraftWithReviewResponse(BaseModel):
    answers: list[DraftAnswer]
    review_comments: list[ReviewComment]
    compliance_flags: list[ComplianceFlag]
    overall_score: float
    tokens_used: TokenUsageResponse | None = None


# --------------------------------------------------------------------------- #
# Compliance Matrix
# --------------------------------------------------------------------------- #

class ComplianceMatrixRequest(BaseModel):
    organization_id: str
    project_id: str
    standard: str


class ComplianceMatrixItem(BaseModel):
    requirement_id: str
    requirement: str
    category: str
    mapped_question: str | None = None
    mapped_question_id: str | None = None
    coverage_status: str  # "covered", "partial", "gap"
    confidence: float
    evidence: str | None = None


class ComplianceMatrixResponse(BaseModel):
    standard: str
    total_requirements: int
    covered: int
    partial: int
    gaps: int
    overall_coverage: float
    items: list[ComplianceMatrixItem]


# --------------------------------------------------------------------------- #
# Knowledge Base Management
# --------------------------------------------------------------------------- #

class AutoTagRequest(BaseModel):
    organization_id: str
    document_id: str
    s3_key: str


class AutoTagResponse(BaseModel):
    tags: list[str]
    industry: str | None = None
    doc_type: str | None = None
    domain: str | None = None
    tokens_used: TokenUsageResponse | None = None


class StaleDocumentResponse(BaseModel):
    document_id: str
    document_title: str
    chunk_count: int
    days_old: int


class DuplicateGroup(BaseModel):
    document_ids: list[str]
    document_titles: list[str]
    similarity_score: float


class FreshnessReportItem(BaseModel):
    document_id: str
    document_title: str
    chunk_count: int
    freshness_score: float
    is_stale: bool


# --------------------------------------------------------------------------- #
# Go/No-Go Scoring
# --------------------------------------------------------------------------- #

class ScoreRequest(BaseModel):
    organization_id: str
    document_id: str
    s3_key: str


class RiskArea(BaseModel):
    requirement: str
    risk_level: str
    explanation: str


class CapabilityGap(BaseModel):
    requirement: str
    gap_description: str


class ScoreResponse(BaseModel):
    go_score: float
    risk_areas: list[RiskArea]
    capability_gaps: list[CapabilityGap]
    recommendation: str
    total_requirements: int
    covered_requirements: int
    tokens_used: TokenUsageResponse | None = None
