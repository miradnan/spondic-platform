import type {
  Project,
  Document,
  RFPQuestion,
  RFPAnswer,
  Chat,
  ChatMessage,
  Tag,
  Team,
  TeamMember,
  AuditLog,
  AnalyticsOverview,
  WinLossAnalytics,
  TimelinePoint,
  UserPerformance,
  PaginatedResponse,
  CreateProjectRequest,
  UpdateProjectRequest,
  UpdateQuestionRequest,
  UpdateAnswerRequest,
  ApproveAnswerRequest,
  AddCommentRequest,
  CreateTagRequest,
  SendMessageRequest,
  CreateChatRequest,
  SearchDocumentsResponse,
  ParseRfpResponse,
  DraftAnswersResponse,
  ExportResponse,
  AuditLogFilters,
  ApprovalStage,
  AnswerApproval,
  CreateApprovalStagesRequest,
  StageApproveRequest,
  OrgBranding,
  UpdateBrandingRequest,
  CRMConnection,
  ProjectCRMLink,
  ConnectCRMRequest,
  LinkProjectToCRMRequest,
  WebhookIntegration,
  CreateWebhookRequest,
  UpdateWebhookRequest,
  Notification,
  NotificationPreference,
  UpdateNotificationPreferenceRequest,
  AnswerActivity,
} from "./types.ts";

const BASE_URL = import.meta.env.VITE_API_URL || "";

// ── Helpers ──────────────────────────────────────────────────────────────────

async function request<T>(
  path: string,
  token: string | null,
  options: RequestInit = {},
): Promise<T> {
  const headers: Record<string, string> = {
    ...(options.headers as Record<string, string> | undefined),
  };
  if (token) {
    headers["Authorization"] = `Bearer ${token}`;
  }
  if (
    !(options.body instanceof FormData) &&
    !headers["Content-Type"]
  ) {
    headers["Content-Type"] = "application/json";
  }
  const res = await fetch(`${BASE_URL}${path}`, { ...options, headers });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error(
      (data as { error?: string }).error || `Request failed (${res.status})`,
    );
  }
  // Handle 204 No Content
  if (res.status === 204) return undefined as T;
  return res.json() as Promise<T>;
}

function qs(params: Record<string, string | number | undefined>): string {
  const entries = Object.entries(params).filter(
    (e): e is [string, string | number] => e[1] !== undefined,
  );
  if (entries.length === 0) return "";
  return "?" + new URLSearchParams(entries.map(([k, v]) => [k, String(v)])).toString();
}

// ── Projects ─────────────────────────────────────────────────────────────────

export function createProject(token: string | null, body: CreateProjectRequest): Promise<Project> {
  return request("/api/projects", token, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function listProjects(
  token: string | null,
  params?: { status?: string; search?: string; page?: number; limit?: number },
): Promise<PaginatedResponse<Project>> {
  return request(`/api/projects${qs(params ?? {})}`, token);
}

export function getProject(token: string | null, id: string): Promise<Project> {
  return request(`/api/projects/${id}`, token);
}

export function updateProject(token: string | null, id: string, body: UpdateProjectRequest): Promise<Project> {
  return request(`/api/projects/${id}`, token, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function deleteProject(token: string | null, id: string): Promise<void> {
  return request(`/api/projects/${id}`, token, { method: "DELETE" });
}

// ── Documents ────────────────────────────────────────────────────────────────

export function uploadDocuments(token: string | null, formData: FormData): Promise<{ documents: Document[] }> {
  return request("/api/documents", token, {
    method: "POST",
    body: formData,
  });
}

export function listDocuments(
  token: string | null,
  params?: { tag?: string; status?: string; page?: number; limit?: number },
): Promise<PaginatedResponse<Document>> {
  return request(`/api/documents${qs(params ?? {})}`, token);
}

export function getDocument(token: string | null, id: string): Promise<Document> {
  return request(`/api/documents/${id}`, token);
}

export function deleteDocument(token: string | null, id: string): Promise<void> {
  return request(`/api/documents/${id}`, token, { method: "DELETE" });
}

export function reindexDocument(token: string | null, id: string): Promise<{ status: string }> {
  return request(`/api/documents/${id}/reindex`, token, { method: "POST" });
}

export function getDocumentPreviewUrl(
  token: string | null,
  id: string,
): Promise<{ url: string; file_name: string; ext: string }> {
  return request(`/api/documents/${id}/preview-url`, token);
}

export function searchDocuments(
  token: string | null,
  query: string,
  tagIds?: string[],
  limit?: number,
): Promise<SearchDocumentsResponse> {
  const params: Record<string, string | number | undefined> = { q: query, limit };
  if (tagIds?.length) params.tag_ids = tagIds.join(",");
  return request(`/api/documents/search${qs(params)}`, token);
}

// ── RFP Upload & Processing ─────────────────────────────────────────────────

export function uploadRfp(token: string | null, formData: FormData): Promise<{ id: string; documents: Document[] }> {
  return request("/api/rfp", token, {
    method: "POST",
    body: formData,
  });
}

export function parseRfp(token: string | null, projectId: string): Promise<ParseRfpResponse> {
  return request(`/api/rfp/${projectId}/parse`, token, { method: "POST" });
}

export function draftAnswers(token: string | null, projectId: string): Promise<DraftAnswersResponse> {
  return request(`/api/rfp/${projectId}/draft`, token, { method: "POST" });
}

// ── Questions ────────────────────────────────────────────────────────────────

export function listQuestions(token: string | null, projectId: string, params?: { page?: number; limit?: number }): Promise<PaginatedResponse<RFPQuestion>> {
  return request(`/api/rfp/${projectId}/questions${qs(params ?? {})}`, token);
}

export function updateQuestion(
  token: string | null,
  projectId: string,
  questionId: string,
  body: UpdateQuestionRequest,
): Promise<RFPQuestion> {
  return request(`/api/rfp/${projectId}/questions/${questionId}`, token, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

// ── Answers ──────────────────────────────────────────────────────────────────

export function listAnswers(token: string | null, projectId: string): Promise<{ answers: RFPAnswer[] }> {
  return request(`/api/rfp/${projectId}/answers`, token);
}

export function updateAnswer(
  token: string | null,
  projectId: string,
  answerId: string,
  body: UpdateAnswerRequest,
): Promise<RFPAnswer> {
  return request(`/api/rfp/${projectId}/answers/${answerId}`, token, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function approveAnswer(
  token: string | null,
  projectId: string,
  answerId: string,
  body: ApproveAnswerRequest,
): Promise<RFPAnswer> {
  return request(`/api/rfp/${projectId}/answers/${answerId}/approve`, token, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function addComment(
  token: string | null,
  projectId: string,
  answerId: string,
  body: AddCommentRequest,
): Promise<{ id: string }> {
  return request(`/api/rfp/${projectId}/answers/${answerId}/comment`, token, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function redraftAnswer(
  token: string | null,
  projectId: string,
  questionId: string,
): Promise<RFPAnswer> {
  return request(`/api/rfp/${projectId}/questions/${questionId}/redraft`, token, {
    method: "POST",
  });
}

export function listAnswerHistory(
  token: string | null,
  projectId: string,
  answerId: string,
): Promise<{ history: AnswerActivity[] }> {
  return request(`/api/rfp/${projectId}/answers/${answerId}/history`, token);
}

// ── Approval Workflows ────────────────────────────────────────────────────────

export function createApprovalStages(
  token: string | null,
  projectId: string,
  body: CreateApprovalStagesRequest,
): Promise<{ stages: ApprovalStage[] }> {
  return request(`/api/projects/${projectId}/approval-stages`, token, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function listApprovalStages(
  token: string | null,
  projectId: string,
): Promise<{ stages: ApprovalStage[] }> {
  return request(`/api/projects/${projectId}/approval-stages`, token);
}

export function stageApprove(
  token: string | null,
  projectId: string,
  answerId: string,
  body: StageApproveRequest,
): Promise<AnswerApproval> {
  return request(`/api/rfp/${projectId}/answers/${answerId}/stage-approve`, token, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function listAnswerApprovals(
  token: string | null,
  projectId: string,
  answerId: string,
): Promise<{ approvals: AnswerApproval[] }> {
  return request(`/api/rfp/${projectId}/answers/${answerId}/approvals`, token);
}

export function listAllAnswerApprovals(
  token: string | null,
  projectId: string,
): Promise<{ approvals: Record<string, AnswerApproval[]> }> {
  return request(`/api/rfp/${projectId}/approvals`, token);
}

// ── Chat ─────────────────────────────────────────────────────────────────────

export function createChat(token: string | null, body?: CreateChatRequest): Promise<Chat> {
  return request("/api/chats", token, {
    method: "POST",
    body: JSON.stringify(body ?? {}),
  });
}

export function listChats(token: string | null): Promise<PaginatedResponse<Chat>> {
  return request("/api/chats", token);
}

export function sendMessage(
  token: string | null,
  chatId: string,
  body: SendMessageRequest,
): Promise<{ user_message: ChatMessage; assistant_message: ChatMessage }> {
  return request(`/api/chats/${chatId}/messages`, token, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function deleteChat(token: string | null, chatId: string): Promise<void> {
  return request(`/api/chats/${chatId}`, token, { method: "DELETE" });
}

export interface StreamChatCitation {
  document_title: string;
  citation_text: string;
  relevance_score: number;
}

export async function sendMessageStream(
  token: string | null,
  chatId: string,
  body: SendMessageRequest,
  onText: (text: string) => void,
  onCitations: (citations: StreamChatCitation[]) => void,
  onDone: () => void,
  onError: (error: string) => void,
): Promise<void> {
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  let res: Response;
  try {
    res = await fetch(`${BASE_URL}/api/chats/${chatId}/messages/stream`, {
      method: "POST",
      headers,
      body: JSON.stringify(body),
    });
  } catch {
    onError("Network error — could not reach server");
    return;
  }

  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    onError((data as { error?: string }).error || `Request failed (${res.status})`);
    return;
  }

  const reader = res.body?.getReader();
  if (!reader) {
    onError("Streaming not supported");
    return;
  }

  const decoder = new TextDecoder();
  let buffer = "";

  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });
      const lines = buffer.split("\n");
      buffer = lines.pop() || "";

      for (const line of lines) {
        if (line.startsWith("data: ")) {
          try {
            const data = JSON.parse(line.slice(6)) as {
              type: string;
              content?: string;
              citations?: StreamChatCitation[];
              error?: string;
            };
            if (data.type === "text" && data.content) {
              onText(data.content);
            } else if (data.type === "citations" && data.citations) {
              onCitations(data.citations);
            } else if (data.type === "done") {
              onDone();
              return;
            } else if (data.type === "error") {
              onError(data.error || "Stream error");
              return;
            }
          } catch {
            // Ignore malformed SSE lines
          }
        }
      }
    }
    // If we reach here without a done event, still notify done
    onDone();
  } catch {
    onError("Stream interrupted");
  }
}

export function getMessages(token: string | null, chatId: string): Promise<PaginatedResponse<ChatMessage>> {
  return request(`/api/chats/${chatId}/messages`, token);
}

// ── Tags ─────────────────────────────────────────────────────────────────────

export function createTag(token: string | null, body: CreateTagRequest): Promise<Tag> {
  return request("/api/tags", token, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function listTags(token: string | null): Promise<{ tags: Tag[] }> {
  return request("/api/tags", token);
}

export function deleteTag(token: string | null, id: string): Promise<void> {
  return request(`/api/tags/${id}`, token, { method: "DELETE" });
}

export function addTagToDocument(token: string | null, documentId: string, tagId: string): Promise<void> {
  return request(`/api/documents/${documentId}/tags`, token, {
    method: "POST",
    body: JSON.stringify({ tag_id: tagId }),
  });
}

export function removeTagFromDocument(token: string | null, documentId: string, tagId: string): Promise<void> {
  return request(`/api/documents/${documentId}/tags/${tagId}`, token, { method: "DELETE" });
}

// ── Users (Clerk search) ──────────────────────────────────────────────────

export interface UserSearchResult {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  image_url: string;
}

export function searchUsers(token: string | null, query: string): Promise<UserSearchResult[]> {
  return request(`/api/users/search${qs({ q: query })}`, token);
}

// ── Teams ─────────────────────────────────────────────────────────────────

export function listTeams(token: string | null): Promise<{ teams: Team[]; total: number }> {
  return request("/api/teams", token);
}

export function createTeam(token: string | null, data: { name: string }): Promise<Team> {
  return request("/api/teams", token, {
    method: "POST",
    body: JSON.stringify(data),
  });
}

export function updateTeam(token: string | null, id: string, data: { name: string }): Promise<Team> {
  return request(`/api/teams/${id}`, token, {
    method: "PUT",
    body: JSON.stringify(data),
  });
}

export function deleteTeam(token: string | null, id: string): Promise<void> {
  return request(`/api/teams/${id}`, token, { method: "DELETE" });
}

export function seedDefaultTeams(token: string | null): Promise<{ teams: Team[]; created: boolean }> {
  return request("/api/teams/seed", token, { method: "POST" });
}

export function listTeamMembers(token: string | null, teamId: string): Promise<{ members: TeamMember[]; total: number }> {
  return request(`/api/teams/${teamId}/members`, token);
}

export function addTeamMember(token: string | null, teamId: string, userId: string): Promise<TeamMember> {
  return request(`/api/teams/${teamId}/members`, token, {
    method: "POST",
    body: JSON.stringify({ user_id: userId }),
  });
}

export function removeTeamMember(token: string | null, teamId: string, userId: string): Promise<void> {
  return request(`/api/teams/${teamId}/members/${userId}`, token, { method: "DELETE" });
}

// ── Export ────────────────────────────────────────────────────────────────────

async function downloadBlob(
  path: string,
  token: string | null,
  filename: string,
): Promise<{ download_url: string }> {
  const headers: Record<string, string> = {};
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${BASE_URL}${path}`, {
    method: "POST",
    headers,
  });
  if (!res.ok) {
    const data = await res.json().catch(() => ({}));
    throw new Error((data as { error?: string }).error || `Export failed (${res.status})`);
  }

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);

  // Trigger download
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);

  // Clean up after a delay
  setTimeout(() => URL.revokeObjectURL(url), 10000);

  return { download_url: url };
}

export function exportDocx(token: string | null, projectId: string): Promise<ExportResponse> {
  return downloadBlob(`/api/rfp/${projectId}/export/docx`, token, `rfp-export-${projectId}.docx`);
}

export function exportPdf(token: string | null, projectId: string): Promise<ExportResponse> {
  return downloadBlob(`/api/rfp/${projectId}/export/pdf`, token, `rfp-export-${projectId}.pdf`);
}

// ── Analytics ────────────────────────────────────────────────────────────────

export function getOverview(token: string | null): Promise<AnalyticsOverview> {
  return request("/api/analytics/overview", token);
}

export function getWinLossAnalytics(token: string | null): Promise<WinLossAnalytics> {
  return request("/api/analytics/win-loss", token);
}

export function getTimeline(
  token: string | null,
  periodStart?: string,
  periodEnd?: string,
): Promise<TimelinePoint[]> {
  const params: Record<string, string> = {};
  if (periodStart) params.period_start = periodStart;
  if (periodEnd) params.period_end = periodEnd;
  return request(`/api/analytics/timeline${qs(params)}`, token);
}

export function getUserPerformance(
  token: string | null,
  periodStart?: string,
  periodEnd?: string,
): Promise<UserPerformance[]> {
  const params: Record<string, string> = {};
  if (periodStart) params.period_start = periodStart;
  if (periodEnd) params.period_end = periodEnd;
  return request(`/api/analytics/user-performance${qs(params)}`, token);
}

// ── Audit ────────────────────────────────────────────────────────────────────

export function listAuditLogs(
  token: string | null,
  filters?: AuditLogFilters,
): Promise<PaginatedResponse<AuditLog>> {
  return request(`/api/audit-logs${qs(filters as Record<string, string | number | undefined> ?? {})}`, token);
}

// ── Branding ──────────────────────────────────────────────────────────────────

export function getBranding(token: string | null): Promise<OrgBranding> {
  return request("/api/branding", token);
}

export function updateBranding(token: string | null, body: UpdateBrandingRequest): Promise<OrgBranding> {
  return request("/api/branding", token, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function uploadBrandingLogo(token: string | null, formData: FormData): Promise<{ logo_url: string }> {
  return request("/api/branding/logo", token, {
    method: "POST",
    body: formData,
  });
}

// ── CRM Integrations ─────────────────────────────────────────────────────────

export function listCRMConnections(token: string | null): Promise<{ connections: CRMConnection[] }> {
  return request("/api/integrations/crm", token);
}

export function connectCRM(token: string | null, body: ConnectCRMRequest): Promise<{ connection: CRMConnection; status: string; message: string }> {
  return request("/api/integrations/crm/connect", token, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function disconnectCRM(token: string | null, id: string): Promise<void> {
  return request(`/api/integrations/crm/${id}`, token, { method: "DELETE" });
}

export function syncCRM(token: string | null, id: string, projectId: string): Promise<{ status: string; message: string }> {
  return request(`/api/integrations/crm/${id}/sync`, token, {
    method: "POST",
    body: JSON.stringify({ project_id: projectId }),
  });
}

// ── Project CRM Links ────────────────────────────────────────────────────────

export function getProjectCRMLink(token: string | null, projectId: string): Promise<{ link: ProjectCRMLink | null }> {
  return request(`/api/projects/${projectId}/crm-link`, token);
}

export function linkProjectToCRM(token: string | null, projectId: string, body: LinkProjectToCRMRequest): Promise<{ link: ProjectCRMLink }> {
  return request(`/api/projects/${projectId}/crm-link`, token, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function unlinkProjectFromCRM(token: string | null, projectId: string): Promise<void> {
  return request(`/api/projects/${projectId}/crm-link`, token, { method: "DELETE" });
}

// ── Webhook Integrations (Slack / Teams) ────────────────────────────────────

export function listWebhooks(token: string | null): Promise<{ webhooks: WebhookIntegration[] }> {
  return request("/api/integrations/webhooks", token);
}

export function createWebhook(token: string | null, body: CreateWebhookRequest): Promise<WebhookIntegration> {
  return request("/api/integrations/webhooks", token, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function updateWebhook(token: string | null, id: string, body: UpdateWebhookRequest): Promise<WebhookIntegration> {
  return request(`/api/integrations/webhooks/${id}`, token, {
    method: "PUT",
    body: JSON.stringify(body),
  });
}

export function deleteWebhook(token: string | null, id: string): Promise<void> {
  return request(`/api/integrations/webhooks/${id}`, token, { method: "DELETE" });
}

export function testWebhook(token: string | null, id: string): Promise<{ status: string }> {
  return request(`/api/integrations/webhooks/${id}/test`, token, { method: "POST" });
}

// ── Notifications ─────────────────────────────────────────────────────────
export function listNotifications(token: string | null, params?: { unread_only?: boolean; page?: number; limit?: number }): Promise<PaginatedResponse<Notification>> {
  return request(`/api/notifications${qs(params as Record<string, string | number | undefined> ?? {})}`, token);
}
export function getUnreadCount(token: string | null): Promise<{ count: number }> {
  return request("/api/notifications/unread-count", token);
}
export function markNotificationRead(token: string | null, id: string): Promise<Notification> {
  return request(`/api/notifications/${id}/read`, token, { method: "PUT" });
}
export function markAllNotificationsRead(token: string | null): Promise<{ updated: number }> {
  return request("/api/notifications/read-all", token, { method: "PUT" });
}
export function getNotificationPreferences(token: string | null): Promise<NotificationPreference[]> {
  return request("/api/notifications/preferences", token);
}
export function updateNotificationPreference(token: string | null, body: UpdateNotificationPreferenceRequest): Promise<NotificationPreference> {
  return request("/api/notifications/preferences", token, { method: "PUT", body: JSON.stringify(body) });
}

// ── Billing ───────────────────────────────────────────────────────────────

export interface SubscriptionResponse {
  subscription: {
    id: string;
    organization_id: string;
    stripe_customer_id: string;
    stripe_subscription_id: string | null;
    plan: string;
    status: string; // 'active' | 'past_due' | 'canceled' | 'trialing' | 'incomplete'
    current_period_start: string | null;
    current_period_end: string | null;
    cancel_at: string | null;
    canceled_at: string | null;
    created_at: string;
    updated_at: string;
  };
  plan_limits: {
    plan: string;
    max_rfps_per_month: number | null;
    max_documents: number | null;
    max_users: number | null;
    max_questions_per_rfp: number | null;
    ai_review_enabled: boolean;
    compliance_enabled: boolean;
    template_library: boolean;
    analytics_enabled: boolean;
  };
}

export function getSubscription(token: string | null): Promise<SubscriptionResponse> {
  return request("/api/billing/subscription", token);
}

export interface TokenUsageResponse {
  tokens_used: number;
  tokens_overage: number;
  max_tokens_per_month: number | null;
  overage_rate_cents_per_1k: number | null;
  plan: string;
  period_start: string;
}

export function getTokenUsage(token: string | null): Promise<TokenUsageResponse> {
  return request("/api/billing/token-usage", token);
}

export function createCheckout(
  token: string | null,
  body: { plan: string; success_url: string; cancel_url: string },
): Promise<{ checkout_url: string }> {
  return request("/api/billing/checkout", token, {
    method: "POST",
    body: JSON.stringify(body),
  });
}

export function createPortalSession(
  token: string | null,
  body: { return_url: string },
): Promise<{ portal_url: string }> {
  return request("/api/billing/portal", token, {
    method: "POST",
    body: JSON.stringify(body),
  });
}
