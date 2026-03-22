import { useAuth } from "@clerk/react";
import {
  useQuery,
  useMutation,
  useQueryClient,
  type UseQueryOptions,
} from "@tanstack/react-query";
import * as api from "../lib/api.ts";
import type {
  Project,
  Document,
  RFPQuestion,
  RFPAnswer,
  Citation,
  Chat,
  ChatMessage,
  Tag,
  Team,
  TeamMember,
  AuditLog,
  AnalyticsOverview,
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
} from "../lib/types.ts";

// ── Helper: get token from Clerk ─────────────────────────────────────────────

function useToken() {
  const { getToken } = useAuth();
  return getToken;
}

// ── Projects ─────────────────────────────────────────────────────────────────

export function useProjects(params?: { status?: string; search?: string; page?: number; limit?: number }) {
  const getToken = useToken();
  return useQuery<PaginatedResponse<Project>>({
    queryKey: ["projects", params],
    queryFn: async () => {
      const token = await getToken();
      return api.listProjects(token, params);
    },
  });
}

export function useProject(id: string | undefined) {
  const getToken = useToken();
  return useQuery<Project>({
    queryKey: ["project", id],
    queryFn: async () => {
      const token = await getToken();
      return api.getProject(token, id!);
    },
    enabled: !!id,
  } satisfies UseQueryOptions<Project>);
}

export function useCreateProject() {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation<Project, Error, CreateProjectRequest>({
    mutationFn: async (body) => {
      const token = await getToken();
      return api.createProject(token, body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useUpdateProject() {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation<Project, Error, { id: string; body: UpdateProjectRequest }>({
    mutationFn: async ({ id, body }) => {
      const token = await getToken();
      return api.updateProject(token, id, body);
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["projects"] });
      void qc.invalidateQueries({ queryKey: ["project", vars.id] });
    },
  });
}

export function useDeleteProject() {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const token = await getToken();
      return api.deleteProject(token, id);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

// ── Documents ────────────────────────────────────────────────────────────────

export function useDocuments(params?: { tag?: string; status?: string; page?: number; limit?: number }) {
  const getToken = useToken();
  return useQuery<PaginatedResponse<Document>>({
    queryKey: ["documents", params],
    queryFn: async () => {
      const token = await getToken();
      return api.listDocuments(token, params);
    },
  });
}

export function useDocument(id: string | undefined) {
  const getToken = useToken();
  return useQuery<Document>({
    queryKey: ["document", id],
    queryFn: async () => {
      const token = await getToken();
      return api.getDocument(token, id!);
    },
    enabled: !!id,
  });
}

export function useUploadDocument() {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation<{ documents: Document[] }, Error, FormData>({
    mutationFn: async (formData) => {
      const token = await getToken();
      return api.uploadDocuments(token, formData);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

export function useDeleteDocument() {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const token = await getToken();
      return api.deleteDocument(token, id);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

export function useReindexDocument() {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation<{ status: string }, Error, string>({
    mutationFn: async (id) => {
      const token = await getToken();
      return api.reindexDocument(token, id);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

export function useSearchDocuments() {
  const getToken = useToken();
  return useMutation({
    mutationFn: async ({ query, tagIds, limit }: { query: string; tagIds?: string[]; limit?: number }) => {
      const token = await getToken();
      return api.searchDocuments(token, query, tagIds, limit);
    },
  });
}

// ── RFP Upload & Processing ─────────────────────────────────────────────────

export function useUploadRfp() {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation<{ id: string; documents: Document[] }, Error, FormData>({
    mutationFn: async (formData) => {
      const token = await getToken();
      return api.uploadRfp(token, formData);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["projects"] });
    },
  });
}

export function useParseRfp() {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (projectId: string) => {
      const token = await getToken();
      return api.parseRfp(token, projectId);
    },
    onSuccess: (_data, projectId) => {
      void qc.invalidateQueries({ queryKey: ["questions", projectId] });
      void qc.invalidateQueries({ queryKey: ["project", projectId] });
    },
  });
}

export function useDraftAnswers() {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (projectId: string) => {
      const token = await getToken();
      return api.draftAnswers(token, projectId);
    },
    onSuccess: (_data, projectId) => {
      void qc.invalidateQueries({ queryKey: ["answers", projectId] });
      void qc.invalidateQueries({ queryKey: ["project", projectId] });
    },
  });
}

// ── Questions ────────────────────────────────────────────────────────────────

export function useQuestions(projectId: string | undefined) {
  const getToken = useToken();
  return useQuery<PaginatedResponse<RFPQuestion>>({
    queryKey: ["questions", projectId],
    queryFn: async () => {
      const token = await getToken();
      return api.listQuestions(token, projectId!, { limit: 100 });
    },
    enabled: !!projectId,
  });
}

export function useUpdateQuestion() {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation<RFPQuestion, Error, { projectId: string; questionId: string; body: UpdateQuestionRequest }>({
    mutationFn: async ({ projectId, questionId, body }) => {
      const token = await getToken();
      return api.updateQuestion(token, projectId, questionId, body);
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["questions", vars.projectId] });
    },
  });
}

// ── Answers ──────────────────────────────────────────────────────────────────

export function useAnswers(projectId: string | undefined) {
  const getToken = useToken();
  return useQuery<{ answers: RFPAnswer[] }>({
    queryKey: ["answers", projectId],
    queryFn: async () => {
      const token = await getToken();
      return api.listAnswers(token, projectId!);
    },
    enabled: !!projectId,
  });
}

export function useUpdateAnswer() {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation<RFPAnswer, Error, { projectId: string; answerId: string; body: UpdateAnswerRequest }>({
    mutationFn: async ({ projectId, answerId, body }) => {
      const token = await getToken();
      return api.updateAnswer(token, projectId, answerId, body);
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["answers", vars.projectId] });
    },
  });
}

export function useApproveAnswer() {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation<RFPAnswer, Error, { projectId: string; answerId: string; body: ApproveAnswerRequest }>({
    mutationFn: async ({ projectId, answerId, body }) => {
      const token = await getToken();
      return api.approveAnswer(token, projectId, answerId, body);
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["answers", vars.projectId] });
      void qc.invalidateQueries({ queryKey: ["project", vars.projectId] });
    },
  });
}

export function useAddComment() {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation<{ id: string }, Error, { projectId: string; answerId: string; body: AddCommentRequest }>({
    mutationFn: async ({ projectId, answerId, body }) => {
      const token = await getToken();
      return api.addComment(token, projectId, answerId, body);
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["answers", vars.projectId] });
    },
  });
}

export function useRedraftAnswer() {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation<RFPAnswer, Error, { projectId: string; questionId: string }>({
    mutationFn: async ({ projectId, questionId }) => {
      const token = await getToken();
      return api.redraftAnswer(token, projectId, questionId);
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["answers", vars.projectId] });
    },
  });
}

// ── Approval Workflows ────────────────────────────────────────────────────────

export function useApprovalStages(projectId: string | undefined) {
  const getToken = useToken();
  return useQuery<{ stages: ApprovalStage[] }>({
    queryKey: ["approvalStages", projectId],
    queryFn: async () => {
      const token = await getToken();
      return api.listApprovalStages(token, projectId!);
    },
    enabled: !!projectId,
  });
}

export function useCreateApprovalStages() {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation<{ stages: ApprovalStage[] }, Error, { projectId: string; body: CreateApprovalStagesRequest }>({
    mutationFn: async ({ projectId, body }) => {
      const token = await getToken();
      return api.createApprovalStages(token, projectId, body);
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["approvalStages", vars.projectId] });
    },
  });
}

export function useAnswerApprovals(projectId: string | undefined, answerId: string | undefined) {
  const getToken = useToken();
  return useQuery<{ approvals: AnswerApproval[] }>({
    queryKey: ["answerApprovals", projectId, answerId],
    queryFn: async () => {
      const token = await getToken();
      return api.listAnswerApprovals(token, projectId!, answerId!);
    },
    enabled: !!projectId && !!answerId,
  });
}

export function useAllAnswerApprovals(projectId: string | undefined) {
  const getToken = useToken();
  return useQuery<{ approvals: Record<string, AnswerApproval[]> }>({
    queryKey: ["allAnswerApprovals", projectId],
    queryFn: async () => {
      const token = await getToken();
      return api.listAllAnswerApprovals(token, projectId!);
    },
    enabled: !!projectId,
  });
}

export function useStageApprove() {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation<AnswerApproval, Error, { projectId: string; answerId: string; body: StageApproveRequest }>({
    mutationFn: async ({ projectId, answerId, body }) => {
      const token = await getToken();
      return api.stageApprove(token, projectId, answerId, body);
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["answerApprovals", vars.projectId, vars.answerId] });
      void qc.invalidateQueries({ queryKey: ["allAnswerApprovals", vars.projectId] });
      void qc.invalidateQueries({ queryKey: ["answers", vars.projectId] });
      void qc.invalidateQueries({ queryKey: ["project", vars.projectId] });
    },
  });
}

// ── Chat ─────────────────────────────────────────────────────────────────────

export function useChats() {
  const getToken = useToken();
  return useQuery<PaginatedResponse<Chat>>({
    queryKey: ["chats"],
    queryFn: async () => {
      const token = await getToken();
      return api.listChats(token);
    },
  });
}

export function useChatMessages(chatId: string | undefined) {
  const getToken = useToken();
  return useQuery<PaginatedResponse<ChatMessage>>({
    queryKey: ["chatMessages", chatId],
    queryFn: async () => {
      const token = await getToken();
      return api.getMessages(token, chatId!);
    },
    enabled: !!chatId,
  });
}

export function useCreateChat() {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation<Chat, Error, CreateChatRequest | undefined>({
    mutationFn: async (body) => {
      const token = await getToken();
      return api.createChat(token, body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["chats"] });
    },
  });
}

export function useDeleteChat() {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (chatId) => {
      const token = await getToken();
      return api.deleteChat(token, chatId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["chats"] });
    },
  });
}

export function useSendMessage() {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation<{ user_message: ChatMessage; assistant_message: ChatMessage; citations?: Citation[] }, Error, { chatId: string; body: SendMessageRequest }>({
    mutationFn: async ({ chatId, body }) => {
      const token = await getToken();
      return api.sendMessage(token, chatId, body);
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["chatMessages", vars.chatId] });
      void qc.invalidateQueries({ queryKey: ["chats"] });
    },
  });
}

// ── Tags ─────────────────────────────────────────────────────────────────────

export function useTags() {
  const getToken = useToken();
  return useQuery<{ tags: Tag[] }>({
    queryKey: ["tags"],
    queryFn: async () => {
      const token = await getToken();
      return api.listTags(token);
    },
  });
}

export function useCreateTag() {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation<Tag, Error, CreateTagRequest>({
    mutationFn: async (body) => {
      const token = await getToken();
      return api.createTag(token, body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tags"] });
    },
  });
}

export function useDeleteTag() {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const token = await getToken();
      return api.deleteTag(token, id);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["tags"] });
    },
  });
}

export function useAddTagToDocument() {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation<void, Error, { documentId: string; tagId: string }>({
    mutationFn: async ({ documentId, tagId }) => {
      const token = await getToken();
      return api.addTagToDocument(token, documentId, tagId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

export function useRemoveTagFromDocument() {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation<void, Error, { documentId: string; tagId: string }>({
    mutationFn: async ({ documentId, tagId }) => {
      const token = await getToken();
      return api.removeTagFromDocument(token, documentId, tagId);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["documents"] });
    },
  });
}

// ── Teams ─────────────────────────────────────────────────────────────────────

export function useTeams() {
  const getToken = useToken();
  return useQuery<{ teams: Team[]; total: number }>({
    queryKey: ["teams"],
    queryFn: async () => {
      const token = await getToken();
      return api.listTeams(token);
    },
  });
}

export function useCreateTeam() {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation<Team, Error, { name: string }>({
    mutationFn: async (body) => {
      const token = await getToken();
      return api.createTeam(token, body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}

export function useUpdateTeam() {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation<Team, Error, { id: string; name: string }>({
    mutationFn: async ({ id, name }) => {
      const token = await getToken();
      return api.updateTeam(token, id, { name });
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}

export function useDeleteTeam() {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const token = await getToken();
      return api.deleteTeam(token, id);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}

export function useSeedDefaultTeams() {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation<{ teams: Team[]; created: boolean }, Error, void>({
    mutationFn: async () => {
      const token = await getToken();
      return api.seedDefaultTeams(token);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}

export function useTeamMembers(teamId: string) {
  const getToken = useToken();
  return useQuery<{ members: TeamMember[]; total: number }>({
    queryKey: ["teamMembers", teamId],
    queryFn: async () => {
      const token = await getToken();
      return api.listTeamMembers(token, teamId);
    },
    enabled: !!teamId,
  });
}

export function useAddTeamMember() {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation<TeamMember, Error, { teamId: string; userId: string }>({
    mutationFn: async ({ teamId, userId }) => {
      const token = await getToken();
      return api.addTeamMember(token, teamId, userId);
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["teamMembers", vars.teamId] });
      void qc.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}

export function useRemoveTeamMember() {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation<void, Error, { teamId: string; userId: string }>({
    mutationFn: async ({ teamId, userId }) => {
      const token = await getToken();
      return api.removeTeamMember(token, teamId, userId);
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["teamMembers", vars.teamId] });
      void qc.invalidateQueries({ queryKey: ["teams"] });
    },
  });
}

// ── Export ────────────────────────────────────────────────────────────────────

export function useExportDocx() {
  const getToken = useToken();
  return useMutation({
    mutationFn: async (projectId: string) => {
      const token = await getToken();
      return api.exportDocx(token, projectId);
    },
  });
}

export function useExportPdf() {
  const getToken = useToken();
  return useMutation({
    mutationFn: async (projectId: string) => {
      const token = await getToken();
      return api.exportPdf(token, projectId);
    },
  });
}

// ── Analytics ────────────────────────────────────────────────────────────────

export function useAnalytics() {
  const getToken = useToken();
  return useQuery<AnalyticsOverview>({
    queryKey: ["analytics"],
    queryFn: async () => {
      const token = await getToken();
      return api.getOverview(token);
    },
  });
}

// ── Audit Logs ───────────────────────────────────────────────────────────────

export function useAuditLogs(filters?: AuditLogFilters) {
  const getToken = useToken();
  return useQuery<PaginatedResponse<AuditLog>>({
    queryKey: ["auditLogs", filters],
    queryFn: async () => {
      const token = await getToken();
      return api.listAuditLogs(token, filters);
    },
  });
}

// ── Branding ──────────────────────────────────────────────────────────────────

export function useBranding() {
  const getToken = useToken();
  return useQuery<OrgBranding>({
    queryKey: ["branding"],
    queryFn: async () => {
      const token = await getToken();
      return api.getBranding(token);
    },
  });
}

export function useUpdateBranding() {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation<OrgBranding, Error, UpdateBrandingRequest>({
    mutationFn: async (body) => {
      const token = await getToken();
      return api.updateBranding(token, body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["branding"] });
    },
  });
}

export function useUploadBrandingLogo() {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation<{ logo_url: string }, Error, FormData>({
    mutationFn: async (formData) => {
      const token = await getToken();
      return api.uploadBrandingLogo(token, formData);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["branding"] });
    },
  });
}

// ── CRM Integrations ─────────────────────────────────────────────────────────

export function useCRMConnections() {
  const getToken = useToken();
  return useQuery<{ connections: CRMConnection[] }>({
    queryKey: ["crmConnections"],
    queryFn: async () => {
      const token = await getToken();
      return api.listCRMConnections(token);
    },
  });
}

export function useConnectCRM() {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation<{ connection: CRMConnection; status: string; message: string }, Error, ConnectCRMRequest>({
    mutationFn: async (body) => {
      const token = await getToken();
      return api.connectCRM(token, body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["crmConnections"] });
    },
  });
}

export function useDisconnectCRM() {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const token = await getToken();
      return api.disconnectCRM(token, id);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["crmConnections"] });
    },
  });
}

export function useSyncCRM() {
  const getToken = useToken();
  return useMutation<{ status: string; message: string }, Error, { connectionId: string; projectId: string }>({
    mutationFn: async ({ connectionId, projectId }) => {
      const token = await getToken();
      return api.syncCRM(token, connectionId, projectId);
    },
  });
}

// ── Project CRM Links ────────────────────────────────────────────────────────

export function useProjectCRMLink(projectId: string | undefined) {
  const getToken = useToken();
  return useQuery<{ link: ProjectCRMLink | null }>({
    queryKey: ["projectCRMLink", projectId],
    queryFn: async () => {
      const token = await getToken();
      return api.getProjectCRMLink(token, projectId!);
    },
    enabled: !!projectId,
  });
}

export function useLinkProjectToCRM() {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation<{ link: ProjectCRMLink }, Error, { projectId: string; body: LinkProjectToCRMRequest }>({
    mutationFn: async ({ projectId, body }) => {
      const token = await getToken();
      return api.linkProjectToCRM(token, projectId, body);
    },
    onSuccess: (_data, vars) => {
      void qc.invalidateQueries({ queryKey: ["projectCRMLink", vars.projectId] });
    },
  });
}

export function useUnlinkProjectFromCRM() {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (projectId) => {
      const token = await getToken();
      return api.unlinkProjectFromCRM(token, projectId);
    },
    onSuccess: (_data, projectId) => {
      void qc.invalidateQueries({ queryKey: ["projectCRMLink", projectId] });
    },
  });
}

// ── Webhook Integrations (Slack / Teams) ────────────────────────────────────

export function useWebhooks() {
  const getToken = useToken();
  return useQuery<{ webhooks: WebhookIntegration[] }>({
    queryKey: ["webhooks"],
    queryFn: async () => {
      const token = await getToken();
      return api.listWebhooks(token);
    },
  });
}

export function useCreateWebhook() {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation<WebhookIntegration, Error, CreateWebhookRequest>({
    mutationFn: async (body) => {
      const token = await getToken();
      return api.createWebhook(token, body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["webhooks"] });
    },
  });
}

export function useUpdateWebhook() {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation<WebhookIntegration, Error, { id: string; body: UpdateWebhookRequest }>({
    mutationFn: async ({ id, body }) => {
      const token = await getToken();
      return api.updateWebhook(token, id, body);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["webhooks"] });
    },
  });
}

export function useDeleteWebhook() {
  const getToken = useToken();
  const qc = useQueryClient();
  return useMutation<void, Error, string>({
    mutationFn: async (id) => {
      const token = await getToken();
      return api.deleteWebhook(token, id);
    },
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ["webhooks"] });
    },
  });
}

export function useTestWebhook() {
  const getToken = useToken();
  return useMutation<{ status: string }, Error, string>({
    mutationFn: async (id) => {
      const token = await getToken();
      return api.testWebhook(token, id);
    },
  });
}
