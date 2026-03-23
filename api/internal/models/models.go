package models

import (
	"encoding/json"
	"time"
)

// Organization represents a Clerk organization.
type Organization struct {
	ClerkOrgID string    `json:"clerk_org_id"`
	CreatedAt  time.Time `json:"created_at"`
	UpdatedAt  time.Time `json:"updated_at"`
}

// Team represents a team within an organization.
type Team struct {
	ID             string     `json:"id"`
	OrganizationID string     `json:"organization_id"`
	Name           string     `json:"name"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
	DeletedAt      *time.Time `json:"deleted_at,omitempty"`
}

// TeamMember represents a user's membership in a team.
type TeamMember struct {
	TeamID    string    `json:"team_id"`
	UserID    string    `json:"user_id"`
	CreatedAt time.Time `json:"created_at"`
}

// Project represents an RFP project.
type Project struct {
	ID             string     `json:"id"`
	OrganizationID string     `json:"organization_id"`
	Name           string     `json:"name"`
	Description    *string    `json:"description,omitempty"`
	Deadline       *time.Time `json:"deadline,omitempty"`
	Status         string     `json:"status"`
	TeamID         *string    `json:"team_id,omitempty"`
	CreatedBy      string     `json:"created_by"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
	DeletedAt      *time.Time `json:"deleted_at,omitempty"`
	// Computed fields (not always populated)
	QuestionCount  int `json:"question_count,omitempty"`
	DraftCount     int `json:"draft_count,omitempty"`
	InReviewCount  int `json:"in_review_count,omitempty"`
	ApprovedCount  int `json:"approved_count,omitempty"`
	RejectedCount  int `json:"rejected_count,omitempty"`
	DocumentCount  int `json:"document_count,omitempty"`
}

// Document represents a knowledge base or RFP document.
type Document struct {
	ID               string     `json:"id"`
	WeaviateObjectID *string    `json:"weaviate_object_id,omitempty"`
	OrganizationID   string     `json:"organization_id"`
	UploadedByUserID string     `json:"uploaded_by_user_id"`
	Title            *string    `json:"title,omitempty"`
	Description      *string    `json:"description,omitempty"`
	SourceType       *string    `json:"source_type,omitempty"`
	SourceURL        *string    `json:"source_url,omitempty"`
	FileName         *string    `json:"file_name,omitempty"`
	FileSizeBytes    *int64     `json:"file_size_bytes,omitempty"`
	ContentHash      *string    `json:"content_hash,omitempty"`
	Version          int        `json:"version"`
	Status           string     `json:"status"`
	Tags             []Tag      `json:"tags"`
	CreatedAt        time.Time  `json:"created_at"`
	UpdatedAt        time.Time  `json:"updated_at"`
	DeletedAt        *time.Time `json:"deleted_at,omitempty"`
}

// DocumentChunk represents a parsed/embedded chunk of a document.
type DocumentChunk struct {
	ID               string     `json:"id"`
	DocumentID       string     `json:"document_id"`
	WeaviateObjectID *string    `json:"weaviate_object_id,omitempty"`
	OrganizationID   string     `json:"organization_id"`
	ChunkIndex       int        `json:"chunk_index"`
	TokenCount       int        `json:"token_count"`
	EmbeddingModel   *string    `json:"embedding_model,omitempty"`
	CreatedAt        time.Time  `json:"created_at"`
	DeletedAt        *time.Time `json:"deleted_at,omitempty"`
}

// Tag represents a label for categorizing documents.
type Tag struct {
	ID             string    `json:"id"`
	OrganizationID string    `json:"organization_id"`
	Name           string    `json:"name"`
	CreatedAt      time.Time `json:"created_at"`
}

// DocumentTag represents the association between a document and a tag.
type DocumentTag struct {
	OrganizationID string    `json:"organization_id"`
	DocumentID     string    `json:"document_id"`
	TagID          string    `json:"tag_id"`
	CreatedAt      time.Time `json:"created_at"`
}

// RFPQuestion represents a question extracted from an RFP document.
type RFPQuestion struct {
	ID             string     `json:"id"`
	ProjectID      string     `json:"project_id"`
	OrganizationID string     `json:"organization_id"`
	QuestionText   string     `json:"question_text"`
	Section        *string    `json:"section,omitempty"`
	QuestionNumber *int       `json:"question_number,omitempty"`
	IsMandatory    bool       `json:"is_mandatory"`
	WordLimit      *int       `json:"word_limit,omitempty"`
	AssignedTo     *string    `json:"assigned_to,omitempty"`
	Status         string     `json:"status"`
	SortOrder      int        `json:"sort_order"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
	// Computed / joined fields
	Answer         *RFPAnswer `json:"answer,omitempty"`
}

// RFPAnswer represents an AI-drafted or edited answer.
type RFPAnswer struct {
	ID              string     `json:"id"`
	QuestionID      string     `json:"question_id"`
	OrganizationID  string     `json:"organization_id"`
	DraftText       *string    `json:"draft_text,omitempty"`
	EditedText      *string    `json:"edited_text,omitempty"`
	FinalText       *string    `json:"final_text,omitempty"`
	ConfidenceScore *float64   `json:"confidence_score,omitempty"`
	Status          string     `json:"status"`
	ApprovedBy      *string    `json:"approved_by,omitempty"`
	ApprovedAt      *time.Time `json:"approved_at,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
	// Joined fields
	Citations       []RFPAnswerCitation `json:"citations,omitempty"`
	Comments        []RFPAnswerComment  `json:"comments,omitempty"`
}

// RFPAnswerCitation links an answer to source document chunks.
type RFPAnswerCitation struct {
	ID             string   `json:"id"`
	AnswerID       string   `json:"answer_id"`
	DocumentID     *string  `json:"document_id,omitempty"`
	DocumentTitle  string   `json:"document_title"`
	ChunkID        *string  `json:"chunk_id,omitempty"`
	CitationText   string   `json:"citation_text"`
	RelevanceScore *float64 `json:"relevance_score,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
}

// RFPAnswerComment is a review comment on an answer.
type RFPAnswerComment struct {
	ID             string    `json:"id"`
	AnswerID       string    `json:"answer_id"`
	OrganizationID string    `json:"organization_id"`
	UserID         string    `json:"user_id"`
	CommentText    string    `json:"comment_text"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// RFPAnswerHistory stores the activity history of an answer.
type RFPAnswerHistory struct {
	ID           string    `json:"id"`
	AnswerID     string    `json:"answer_id"`
	Action       string    `json:"action"`
	PreviousText *string   `json:"previous_text,omitempty"`
	NewText      *string   `json:"new_text,omitempty"`
	EditedBy     string    `json:"edited_by"`
	EditedByName string    `json:"edited_by_name"`
	EditedAt     time.Time `json:"edited_at"`
}

// Chat represents a chat session.
type Chat struct {
	ID             string     `json:"id"`
	OrganizationID string     `json:"organization_id"`
	UserID         string     `json:"user_id"`
	Title          *string    `json:"title,omitempty"`
	ShareToken     *string    `json:"share_token,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
	DeletedAt      *time.Time `json:"deleted_at,omitempty"`
}

// ChatMessage represents a single message in a chat session.
type ChatMessage struct {
	ID        int64             `json:"id"`
	ChatID    string            `json:"chat_id"`
	Role      string            `json:"role"`
	Message   string            `json:"message"`
	Citations json.RawMessage   `json:"citations"`
	CreatedAt time.Time         `json:"created_at"`
}

// AuditLog records an auditable action.
type AuditLog struct {
	ID             int64                  `json:"id"`
	OrganizationID string                 `json:"organization_id"`
	UserID         string                 `json:"user_id"`
	Action         string                 `json:"action"`
	EntityType     *string                `json:"entity_type,omitempty"`
	EntityID       *string                `json:"entity_id,omitempty"`
	Metadata       map[string]interface{} `json:"metadata,omitempty"`
	IPAddress      *string                `json:"ip_address,omitempty"`
	UserAgent      *string                `json:"user_agent,omitempty"`
	CreatedAt      time.Time              `json:"created_at"`
}

// Pagination is a helper for list endpoints.
type Pagination struct {
	Page       int   `json:"page"`
	Limit      int   `json:"limit"`
	Total      int64 `json:"total"`
	TotalPages int   `json:"total_pages"`
}

// PaginatedResponse wraps any list response with pagination metadata.
type PaginatedResponse struct {
	Data       interface{} `json:"data"`
	Pagination Pagination  `json:"pagination"`
}

// AnalyticsOverview aggregates org-level stats.
type AnalyticsOverview struct {
	TotalProjects         int     `json:"total_projects"`
	TotalRFPsProcessed    int     `json:"total_rfps_processed"`
	TotalDocuments        int     `json:"total_documents"`
	TotalQuestionsDrafted int     `json:"total_questions_drafted"`
	AvgConfidenceScore    float64 `json:"avg_confidence_score"`
}

// Subscription represents a billing subscription for an organization.
type Subscription struct {
	ID                   string     `json:"id"`
	OrganizationID       string     `json:"organization_id"`
	StripeCustomerID     string     `json:"stripe_customer_id"`
	StripeSubscriptionID *string    `json:"stripe_subscription_id,omitempty"`
	Plan                 string     `json:"plan"`
	Status               string     `json:"status"`
	CurrentPeriodStart   *time.Time `json:"current_period_start,omitempty"`
	CurrentPeriodEnd     *time.Time `json:"current_period_end,omitempty"`
	CancelAt             *time.Time `json:"cancel_at,omitempty"`
	CanceledAt           *time.Time `json:"canceled_at,omitempty"`
	CreatedAt            time.Time  `json:"created_at"`
	UpdatedAt            time.Time  `json:"updated_at"`
}

// Invoice represents a billing invoice.
type Invoice struct {
	ID              string     `json:"id"`
	OrganizationID  string     `json:"organization_id"`
	StripeInvoiceID *string    `json:"stripe_invoice_id,omitempty"`
	AmountCents     int        `json:"amount_cents"`
	Currency        string     `json:"currency"`
	Status          string     `json:"status"`
	InvoiceURL      *string    `json:"invoice_url,omitempty"`
	PeriodStart     *time.Time `json:"period_start,omitempty"`
	PeriodEnd       *time.Time `json:"period_end,omitempty"`
	CreatedAt       time.Time  `json:"created_at"`
}

// UsageRecord tracks feature usage per organization per billing period.
type UsageRecord struct {
	ID             string    `json:"id"`
	OrganizationID string    `json:"organization_id"`
	Metric         string    `json:"metric"`
	Count          int       `json:"count"`
	PeriodStart    string    `json:"period_start"`
	PeriodEnd      string    `json:"period_end"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// PlanLimits defines the feature limits for each billing plan.
type PlanLimits struct {
	Plan               string `json:"plan"`
	MaxRFPsPerMonth    *int   `json:"max_rfps_per_month,omitempty"`
	MaxDocuments       *int   `json:"max_documents,omitempty"`
	MaxUsers           *int   `json:"max_users,omitempty"`
	MaxQuestionsPerRFP *int   `json:"max_questions_per_rfp,omitempty"`
	AIReviewEnabled    bool   `json:"ai_review_enabled"`
	ComplianceEnabled  bool   `json:"compliance_enabled"`
	TemplateLibrary    bool   `json:"template_library"`
	AnalyticsEnabled   bool   `json:"analytics_enabled"`
}

// Notification represents an in-app notification for a user.
type Notification struct {
	ID             string    `json:"id"`
	OrganizationID string    `json:"organization_id"`
	UserID         string    `json:"user_id"`
	Type           string    `json:"type"`
	Title          string    `json:"title"`
	Body           *string   `json:"body,omitempty"`
	EntityType     *string   `json:"entity_type,omitempty"`
	EntityID       *string   `json:"entity_id,omitempty"`
	IsRead         bool      `json:"is_read"`
	EmailSent      bool      `json:"email_sent"`
	CreatedAt      time.Time `json:"created_at"`
}

// NotificationPreference controls how a user receives notifications.
type NotificationPreference struct {
	OrganizationID string `json:"organization_id"`
	UserID         string `json:"user_id"`
	Type           string `json:"type"`
	InAppEnabled   bool   `json:"in_app_enabled"`
	EmailEnabled   bool   `json:"email_enabled"`
}

// AnswerTemplate is a reusable template for RFP answer drafting.
type AnswerTemplate struct {
	ID              string     `json:"id"`
	OrganizationID  string     `json:"organization_id"`
	Name            string     `json:"name"`
	Category        *string    `json:"category,omitempty"`
	QuestionPattern *string    `json:"question_pattern,omitempty"`
	AnswerTemplate  string     `json:"answer_template"`
	CreatedBy       string     `json:"created_by"`
	UsageCount      int        `json:"usage_count"`
	CreatedAt       time.Time  `json:"created_at"`
	UpdatedAt       time.Time  `json:"updated_at"`
	DeletedAt       *time.Time `json:"deleted_at,omitempty"`
}

// ProjectOutcome tracks win/loss data for an RFP project.
type ProjectOutcome struct {
	ID             string     `json:"id"`
	ProjectID      string     `json:"project_id"`
	OrganizationID string     `json:"organization_id"`
	Outcome        string     `json:"outcome"`
	RevenueCents   *int64     `json:"revenue_cents,omitempty"`
	Currency       string     `json:"currency"`
	Feedback       *string    `json:"feedback,omitempty"`
	LossReason     *string    `json:"loss_reason,omitempty"`
	SubmittedAt    *time.Time `json:"submitted_at,omitempty"`
	DecidedAt      *time.Time `json:"decided_at,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
	UpdatedAt      time.Time  `json:"updated_at"`
}

// ApprovalStage represents a configurable approval stage for a project.
type ApprovalStage struct {
	ID             string    `json:"id"`
	ProjectID      string    `json:"project_id"`
	OrganizationID string    `json:"organization_id"`
	Name           string    `json:"name"`
	SortOrder      int       `json:"sort_order"`
	RequiredRole   *string   `json:"required_role,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
}

// AnswerApproval tracks the approval status of an answer at a specific stage.
type AnswerApproval struct {
	ID             string     `json:"id"`
	AnswerID       string     `json:"answer_id"`
	StageID        string     `json:"stage_id"`
	StageName      string     `json:"stage_name"`
	SortOrder      int        `json:"sort_order"`
	OrganizationID string     `json:"organization_id"`
	Status         string     `json:"status"`
	ApprovedBy     *string    `json:"approved_by,omitempty"`
	Comment        *string    `json:"comment,omitempty"`
	ApprovedAt     *time.Time `json:"approved_at,omitempty"`
	CreatedAt      time.Time  `json:"created_at"`
}

// OrgBranding stores per-organization white-label / custom branding settings.
type OrgBranding struct {
	OrganizationID string    `json:"organization_id"`
	DisplayName    *string   `json:"display_name,omitempty"`
	LogoURL        *string   `json:"logo_url,omitempty"`
	PrimaryColor   *string   `json:"primary_color,omitempty"`
	SecondaryColor *string   `json:"secondary_color,omitempty"`
	AccentColor    *string   `json:"accent_color,omitempty"`
	FaviconURL     *string   `json:"favicon_url,omitempty"`
	CustomDomain   *string   `json:"custom_domain,omitempty"`
	EmailFromName  *string   `json:"email_from_name,omitempty"`
	EmailFooter    *string   `json:"email_footer_text,omitempty"`
	CreatedAt      time.Time `json:"created_at"`
	UpdatedAt      time.Time `json:"updated_at"`
}

// WinLossAnalytics is the response struct for the win/loss analytics endpoint.
type WinLossAnalytics struct {
	WinRate         float64            `json:"win_rate"`
	TotalWon        int                `json:"total_won"`
	TotalLost       int                `json:"total_lost"`
	TotalRevenue    int64              `json:"total_revenue"`
	AvgResponseDays float64            `json:"avg_response_days"`
	LossReasons     map[string]int     `json:"loss_reasons"`
}

// TimelinePoint represents a single month's project creation stats.
type TimelinePoint struct {
	Month           string `json:"month"`
	ProjectsCreated int    `json:"projects_created"`
	RfpsProcessed   int    `json:"rfps_processed"`
	ActiveUsers     int    `json:"active_users"`
}

// UserPerformance represents per-user performance stats.
type UserPerformance struct {
	UserID            string  `json:"user_id"`
	ProjectsCreated   int     `json:"projects_created"`
	ProjectsCompleted int     `json:"projects_completed"`
	QuestionsAnswered int     `json:"questions_answered"`
	AvgConfidence     float64 `json:"avg_confidence"`
}

// WebhookIntegration represents a Slack or Teams webhook integration for an org.
type WebhookIntegration struct {
	ID             string          `json:"id"`
	OrganizationID string          `json:"organization_id"`
	Platform       string          `json:"platform"`
	WebhookURL     string          `json:"webhook_url"`
	ChannelName    *string         `json:"channel_name,omitempty"`
	IsActive       bool            `json:"is_active"`
	NotifyOn       json.RawMessage `json:"notify_on"`
	CreatedBy      string          `json:"created_by"`
	CreatedAt      time.Time       `json:"created_at"`
	UpdatedAt      time.Time       `json:"updated_at"`
}
