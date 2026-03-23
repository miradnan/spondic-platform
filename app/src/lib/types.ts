// ── Data Models ──────────────────────────────────────────────────────────────

export interface Project {
  id: string;
  organization_id: string;
  name: string;
  description: string;
  deadline: string | null;
  status: "draft" | "parsing" | "parsed" | "in_progress" | "completed" | "submitted";
  question_count: number;
  draft_count: number;
  approved_count: number;
  document_count: number;
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface Document {
  id: string;
  organization_id: string;
  uploaded_by_user_id: string;
  title: string;
  source_type: string;
  file_name: string;
  file_size_bytes: number;
  status: "processing" | "indexed" | "failed";
  version: number;
  tags: Tag[];
  created_at: string;
  updated_at: string;
}

export interface RFPQuestion {
  id: string;
  project_id: string;
  organization_id: string;
  question_text: string;
  section: string;
  question_number: number;
  is_mandatory: boolean;
  word_limit: number | null;
  status: "draft" | "in_review" | "approved";
  created_at: string;
}

export interface Citation {
  id: string;
  answer_id: string;
  document_id: string;
  document_title: string;
  chunk_id: string;
  citation_text: string;
  relevance_score: number;
}

export interface Comment {
  id: string;
  answer_id: string;
  user_id: string;
  user_name: string;
  comment_text: string;
  created_at: string;
}

export interface RFPAnswer {
  id: string;
  question_id: string;
  organization_id: string;
  draft_text: string;
  edited_text: string;
  final_text: string;
  confidence_score: number;
  status: "draft" | "in_review" | "approved" | "rejected";
  approved_by: string | null;
  approved_at: string | null;
  citations: Citation[];
  comments: Comment[];
  created_at: string;
  updated_at: string;
}

export interface Chat {
  id: string;
  organization_id: string;
  user_id: string;
  title: string;
  created_at: string;
  updated_at: string;
}

export interface ChatMessage {
  id: string;
  chat_id: string;
  role: "user" | "assistant";
  message: string;
  citations: Citation[];
  created_at: string;
}

export interface Tag {
  id: string;
  organization_id: string;
  name: string;
  created_at: string;
}

export interface Team {
  id: string;
  organization_id: string;
  name: string;
  member_count: number;
  created_at: string;
  updated_at: string;
}

export interface TeamMember {
  team_id: string;
  user_id: string;
  first_name?: string;
  last_name?: string;
  email?: string;
  image_url?: string;
  created_at: string;
}

export interface AuditLog {
  id: string;
  organization_id: string;
  user_id: string;
  user_name: string;
  action: string;
  entity_type: string;
  entity_id: string;
  metadata: Record<string, unknown>;
  ip_address: string;
  created_at: string;
}

export interface OrgBranding {
  organization_id: string;
  display_name?: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  favicon_url?: string;
  custom_domain?: string;
  email_from_name?: string;
  email_footer_text?: string;
  created_at: string;
  updated_at: string;
}

export interface UpdateBrandingRequest {
  display_name?: string;
  logo_url?: string;
  primary_color?: string;
  secondary_color?: string;
  accent_color?: string;
  favicon_url?: string;
  custom_domain?: string;
  email_from_name?: string;
  email_footer_text?: string;
}

export interface AnalyticsOverview {
  total_projects: number;
  total_rfps_processed: number;
  total_documents: number;
  total_questions_drafted: number;
  avg_confidence_score: number;
}

export interface WinLossAnalytics {
  win_rate: number;
  total_won: number;
  total_lost: number;
  total_revenue: number;
  avg_response_days: number;
  loss_reasons: Record<string, number>;
}

export interface TimelinePoint {
  month: string;
  projects_created: number;
  rfps_processed: number;
  active_users: number;
}

export interface UserPerformance {
  user_id: string;
  projects_created: number;
  projects_completed: number;
  questions_answered: number;
  avg_confidence: number;
}

// ── Request / Response Types ─────────────────────────────────────────────────

export interface Pagination {
  page: number;
  limit: number;
  total: number;
  total_pages: number;
}

export interface PaginatedResponse<T> {
  data: T[];
  pagination: Pagination;
}

export interface CreateProjectRequest {
  name: string;
  description: string;
  deadline?: string;
}

export interface UpdateProjectRequest {
  name?: string;
  description?: string;
  deadline?: string;
  status?: Project["status"];
}

export interface UpdateQuestionRequest {
  question_text?: string;
  is_mandatory?: boolean;
  section?: string;
}

export interface UpdateAnswerRequest {
  edited_text: string;
}

export interface ApproveAnswerRequest {
  status: "approved" | "rejected" | "in_review";
}

export interface AddCommentRequest {
  comment_text: string;
}

export interface AnswerActivity {
  id: string;
  answer_id: string;
  action: "drafted" | "edited" | "approved" | "rejected" | "commented" | "redrafted" | "in_review";
  previous_text: string | null;
  new_text: string | null;
  edited_by: string;
  edited_at: string;
}

export interface CreateTagRequest {
  name: string;
}

export interface SendMessageRequest {
  message: string;
}

export interface CreateChatRequest {
  title?: string;
}

export interface SearchDocumentsRequest {
  query: string;
  tag_ids?: string[];
  limit?: number;
}

export interface SearchDocumentsResponse {
  results: { document: Document; chunk_text: string; score: number }[];
}

export interface ParseRfpResponse {
  questions_found: number;
  status: string;
}

export interface DraftAnswersResponse {
  answers_created: number;
  status: string;
}

export interface ExportResponse {
  download_url: string;
}

// ── Approval Workflow Types ───────────────────────────────────────────────────

export interface ApprovalStage {
  id: string;
  project_id: string;
  organization_id: string;
  name: string;
  sort_order: number;
  required_role?: string;
  created_at: string;
}

export interface AnswerApproval {
  id: string;
  answer_id: string;
  stage_id: string;
  stage_name: string;
  sort_order: number;
  organization_id: string;
  status: "pending" | "approved" | "rejected" | "skipped";
  approved_by?: string;
  comment?: string;
  approved_at?: string;
  created_at: string;
}

export interface CreateApprovalStagesRequest {
  stages: { name: string; sort_order: number; required_role?: string }[];
}

export interface StageApproveRequest {
  stage_id: string;
  status: "approved" | "rejected" | "skipped";
  comment?: string;
}

export interface AuditLogFilters {
  action?: string;
  user_id?: string;
  entity_type?: string;
  date_from?: string;
  date_to?: string;
  page?: number;
  limit?: number;
}

// ── CRM Integration Types ─────────────────────────────────────────────────────

export interface CRMConnection {
  id: string;
  organization_id: string;
  platform: "salesforce" | "hubspot";
  instance_url?: string;
  is_active: boolean;
  connected_by: string;
  token_expires_at?: string;
  created_at: string;
  updated_at: string;
}

export interface ProjectCRMLink {
  id: string;
  project_id: string;
  organization_id: string;
  platform: "salesforce" | "hubspot";
  crm_deal_id: string;
  crm_deal_name?: string;
  crm_deal_stage?: string;
  crm_deal_amount?: number;
  crm_deal_currency: string;
  last_synced_at?: string;
  created_at: string;
}

export interface ConnectCRMRequest {
  platform: "salesforce" | "hubspot";
}

export interface LinkProjectToCRMRequest {
  platform: "salesforce" | "hubspot";
  crm_deal_id: string;
  crm_deal_name?: string;
  crm_deal_stage?: string;
  crm_deal_amount?: number;
  currency?: string;
}

// ── Webhook Integration Types ───────────────────────────────────────────────

export type WebhookPlatform = "slack" | "teams";

export type WebhookEventType =
  | "answer_approved"
  | "rfp_drafted"
  | "rfp_parsed"
  | "deadline_approaching";

export interface WebhookIntegration {
  id: string;
  organization_id: string;
  platform: WebhookPlatform;
  webhook_url: string;
  channel_name?: string;
  is_active: boolean;
  notify_on: WebhookEventType[];
  created_by: string;
  created_at: string;
  updated_at: string;
}

export interface CreateWebhookRequest {
  platform: WebhookPlatform;
  webhook_url: string;
  channel_name?: string;
  notify_on?: WebhookEventType[];
}

export interface UpdateWebhookRequest {
  webhook_url?: string;
  channel_name?: string;
  is_active?: boolean;
  notify_on?: WebhookEventType[];
}

// ── Notification Types ────────────────────────────────────────────────────────

export type NotificationType =
  | "answer_approved"
  | "comment_added"
  | "document_indexed"
  | "rfp_parsed"
  | "rfp_drafted"
  | "deadline_approaching"
  | "team_assignment"
  | "question_assigned";

export interface Notification {
  id: string;
  organization_id: string;
  user_id: string;
  type: NotificationType;
  title: string;
  body?: string;
  entity_type?: string;
  entity_id?: string;
  is_read: boolean;
  email_sent: boolean;
  created_at: string;
}

export interface NotificationPreference {
  organization_id: string;
  user_id: string;
  type: NotificationType;
  in_app_enabled: boolean;
  email_enabled: boolean;
}

export interface UpdateNotificationPreferenceRequest {
  type: NotificationType;
  in_app_enabled: boolean;
  email_enabled: boolean;
}
