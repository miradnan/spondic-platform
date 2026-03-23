import { useState, useRef, useCallback } from "react";
import { useOrganization } from "@clerk/react";
import {
  EnvelopeIcon,
  TrashIcon,
  ClockIcon,
  XMarkIcon,
  UsersIcon,
  ArrowUpTrayIcon,
  ChevronDownIcon,
  CheckIcon,
  XMarkIcon as XMarkIconSolid,
  ShieldCheckIcon,
} from "@heroicons/react/24/outline";
import { CheckCircleIcon, XCircleIcon } from "@heroicons/react/24/solid";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";
import { useTeams } from "../../hooks/useApi.ts";
import { useToast } from "../../components/Toast.tsx";

// ── Types ────────────────────────────────────────────────────────────────────

type RoleOption = "org:admin" | "org:member";

interface CsvRow {
  email: string;
  role: string;
  valid: boolean;
  error?: string;
}

const ROLE_LABELS: Record<string, string> = {
  "org:admin": "Admin",
  "org:member": "Member",
};

const PLACEHOLDER_TEAMS = ["Engineering", "Sales", "Marketing", "Support"];

// ── Permission Matrix Data ──────────────────────────────────────────────────

const PERMISSIONS = [
  { label: "View projects", member: true, admin: true },
  { label: "Create projects", member: true, admin: true },
  { label: "Edit answers", member: true, admin: true },
  { label: "Approve answers", member: false, admin: true },
  { label: "Manage members", member: false, admin: true },
  { label: "View audit log", member: false, admin: true },
  { label: "Manage billing", member: false, admin: true },
];

// ── CSV parsing ─────────────────────────────────────────────────────────────

function parseCsv(text: string): CsvRow[] {
  const lines = text.trim().split("\n");
  const rows: CsvRow[] = [];

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i].trim();
    if (!line) continue;

    // Skip header row
    if (i === 0 && /^email/i.test(line)) continue;

    const parts = line.split(",").map((s) => s.trim().replace(/^["']|["']$/g, ""));
    const email = parts[0] ?? "";
    const role = (parts[1] ?? "member").toLowerCase();

    const emailValid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);
    const roleValid = role === "member" || role === "admin";

    rows.push({
      email,
      role: roleValid ? role : "member",
      valid: emailValid && roleValid,
      error: !emailValid
        ? "Invalid email"
        : !roleValid
          ? `Invalid role "${parts[1]}" — using "member"`
          : undefined,
    });
  }

  return rows;
}

// ── Main Component ───────────────────────────────────────────────────────────

export function AdminMembers() {
  const {
    organization,
    memberships,
    invitations,
    isLoaded,
  } = useOrganization({
    memberships: { pageSize: 50 },
    invitations: { pageSize: 50 },
  });

  const { data: teamsData } = useTeams();
  const { toast } = useToast();

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<RoleOption>("org:member");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  // Bulk import state
  const [showBulkImport, setShowBulkImport] = useState(false);
  const [csvRows, setCsvRows] = useState<CsvRow[]>([]);
  const [bulkInviting, setBulkInviting] = useState(false);
  const [bulkProgress, setBulkProgress] = useState<{ done: number; total: number } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Team assignments (local state — placeholder for API)
  const [teamAssignments, setTeamAssignments] = useState<Record<string, string>>({});

  // Permission matrix collapse
  const [permissionsOpen, setPermissionsOpen] = useState(false);

  const teamNames =
    teamsData?.teams && teamsData.teams.length > 0
      ? teamsData.teams.map((t) => t.name)
      : PLACEHOLDER_TEAMS;

  // ── Team assignment handler ───────────────────────────────────────────
  const handleTeamChange = useCallback(
    (userId: string, team: string) => {
      setTeamAssignments((prev) => ({ ...prev, [userId]: team }));
      toast("success", "Team updated");
    },
    [toast],
  );

  if (!isLoaded || !organization) {
    return (
      <div className="w-full max-w-7xl mx-auto space-y-4">
        <div className="h-6 w-40 animate-pulse rounded bg-gray-200" />
        <div className="h-4 w-64 animate-pulse rounded bg-gray-200" />
        <div className="rounded-xl border border-border bg-white p-6 space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <div key={i} className="flex items-center gap-4">
              <div className="h-10 w-10 animate-pulse rounded-full bg-gray-200" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-32 animate-pulse rounded bg-gray-200" />
                <div className="h-3 w-48 animate-pulse rounded bg-gray-200" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  const memberList = memberships?.data ?? [];
  const invitationList = invitations?.data ?? [];

  // ── Invite handler ──────────────────────────────────────────────────────

  async function handleInvite(e: React.FormEvent) {
    e.preventDefault();
    const email = inviteEmail.trim();
    if (!email || !organization) return;

    setInviting(true);
    setInviteError("");
    setInviteSuccess("");

    try {
      await organization.inviteMembers({
        emailAddresses: [email],
        role: inviteRole,
      });
      setInviteSuccess(`Invitation sent to ${email}`);
      setInviteEmail("");
      invitations?.revalidate?.();
      setTimeout(() => setInviteSuccess(""), 4000);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to send invitation";
      setInviteError(message);
    } finally {
      setInviting(false);
    }
  }

  // ── Bulk import handlers ──────────────────────────────────────────────

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    const reader = new FileReader();
    reader.onload = (ev) => {
      const text = ev.target?.result as string;
      const rows = parseCsv(text);
      setCsvRows(rows);
    };
    reader.readAsText(file);

    // Reset input so same file can be re-selected
    e.target.value = "";
  }

  async function handleBulkInvite() {
    if (!organization || csvRows.length === 0) return;

    const validRows = csvRows.filter((r) => r.valid);
    if (validRows.length === 0) return;

    setBulkInviting(true);
    setBulkProgress({ done: 0, total: validRows.length });

    let successCount = 0;
    let failCount = 0;

    for (let i = 0; i < validRows.length; i++) {
      const row = validRows[i];
      try {
        await organization.inviteMembers({
          emailAddresses: [row.email],
          role: row.role === "admin" ? "org:admin" : "org:member",
        });
        successCount++;
      } catch {
        failCount++;
      }
      setBulkProgress({ done: i + 1, total: validRows.length });
    }

    invitations?.revalidate?.();
    setBulkInviting(false);
    setBulkProgress(null);
    setCsvRows([]);
    setShowBulkImport(false);

    if (failCount === 0) {
      toast("success", `${successCount} invitation${successCount !== 1 ? "s" : ""} sent successfully`);
    } else {
      toast("error", `${successCount} sent, ${failCount} failed`);
    }
  }

  // ── Role change handler ─────────────────────────────────────────────────

  async function handleRoleChange(userId: string, newRole: RoleOption) {
    setActionLoading(userId);
    setActionError("");
    try {
      await organization!.updateMember({ userId, role: newRole });
      memberships?.revalidate?.();
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to update role";
      setActionError(message);
    } finally {
      setActionLoading(null);
    }
  }

  // ── Remove member handler ───────────────────────────────────────────────

  async function handleRemoveMember(userId: string) {
    setActionLoading(userId);
    setActionError("");
    try {
      await organization!.removeMember(userId);
      memberships?.revalidate?.();
      setConfirmRemove(null);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to remove member";
      setActionError(message);
    } finally {
      setActionLoading(null);
    }
  }

  // ── Revoke invitation handler ───────────────────────────────────────────

  async function handleRevokeInvitation(invitationId: string) {
    setActionLoading(invitationId);
    setActionError("");
    try {
      const invite = invitationList.find((i) => i.id === invitationId);
      if (invite) {
        await invite.revoke();
        invitations?.revalidate?.();
      }
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to revoke invitation";
      setActionError(message);
    } finally {
      setActionLoading(null);
    }
  }

  return (
    <div className="w-full max-w-7xl mx-auto">
      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-blue/10">
            <UsersIcon className="h-5 w-5 text-brand-blue" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-heading">Members</h1>
            <p className="text-sm text-body">
              Invite new members, manage roles, and view pending invitations.
            </p>
          </div>
        </div>
      </div>

      {/* Global action error */}
      {actionError && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">
          <span>{actionError}</span>
          <button
            onClick={() => setActionError("")}
            className="ml-auto text-red-500 hover:text-red-700"
          >
            <XMarkIcon className="h-4 w-4" />
          </button>
        </div>
      )}

      {/* ── Invite Section ─────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-white p-5 mb-6">
        <h3 className="text-sm font-semibold text-heading mb-3 flex items-center gap-2">
          <EnvelopeIcon className="h-4 w-4 text-brand-blue" />
          Invite Members
        </h3>
        <form onSubmit={handleInvite} className="flex items-end gap-3">
          <div className="flex-1 max-w-sm">
            <label
              htmlFor="invite-email"
              className="block text-xs font-medium text-muted mb-1"
            >
              Email address
            </label>
            <Input
              id="invite-email"
              type="email"
              placeholder="colleague@company.com"
              value={inviteEmail}
              onChange={(e) => setInviteEmail(e.target.value)}
              disabled={inviting}
            />
          </div>
          <div className="w-32">
            <label className="block text-xs font-medium text-muted mb-1">
              Role
            </label>
            <Select
              value={inviteRole}
              onValueChange={(val) => setInviteRole(val as RoleOption)}
              disabled={inviting}
            >
              <SelectTrigger className="h-10 w-full">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="org:member">Member</SelectItem>
                <SelectItem value="org:admin">Admin</SelectItem>
              </SelectContent>
            </Select>
          </div>
          <Button type="submit" disabled={!inviteEmail.trim() || inviting}>
            {inviting ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Sending...
              </>
            ) : (
              "Send Invite"
            )}
          </Button>
          <Button
            type="button"
            variant="outline"
            onClick={() => setShowBulkImport(!showBulkImport)}
          >
            <ArrowUpTrayIcon className="h-4 w-4 mr-1.5" />
            Bulk Import
          </Button>
        </form>
        {inviteError && (
          <p className="mt-2 text-sm text-red-600">{inviteError}</p>
        )}
        {inviteSuccess && (
          <p className="mt-2 text-sm text-green-600">{inviteSuccess}</p>
        )}

        {/* ── Bulk Import Panel ──────────────────────────────────────────── */}
        {showBulkImport && (
          <div className="mt-4 rounded-lg border border-border bg-cream-light/30 p-4">
            <div className="flex items-center justify-between mb-3">
              <h4 className="text-sm font-semibold text-heading">Bulk Import via CSV</h4>
              <button
                onClick={() => {
                  setShowBulkImport(false);
                  setCsvRows([]);
                }}
                className="text-muted hover:text-heading transition-colors"
              >
                <XMarkIcon className="h-4 w-4" />
              </button>
            </div>
            <p className="text-xs text-muted mb-3">
              Upload a CSV file with columns: <strong>email, role</strong> (member/admin).
              The first row is treated as a header if it starts with "email".
            </p>

            <input
              ref={fileInputRef}
              type="file"
              accept=".csv,text/csv"
              onChange={handleFileChange}
              className="hidden"
            />
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={bulkInviting}
            >
              <ArrowUpTrayIcon className="h-4 w-4 mr-1.5" />
              Choose CSV File
            </Button>

            {/* Preview table */}
            {csvRows.length > 0 && (
              <div className="mt-4">
                <p className="text-xs font-medium text-heading mb-2">
                  Preview ({csvRows.filter((r) => r.valid).length} valid of {csvRows.length} rows)
                </p>
                <div className="max-h-48 overflow-y-auto rounded-lg border border-border bg-white">
                  <table className="w-full text-sm">
                    <thead>
                      <tr className="border-b border-border bg-gray-50">
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted">Email</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted">Role</th>
                        <th className="px-3 py-2 text-left text-xs font-medium text-muted">Status</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-border">
                      {csvRows.map((row, i) => (
                        <tr key={i} className={row.valid ? "" : "bg-red-50/50"}>
                          <td className="px-3 py-1.5 text-heading">{row.email}</td>
                          <td className="px-3 py-1.5 capitalize text-body">{row.role}</td>
                          <td className="px-3 py-1.5">
                            {row.valid ? (
                              <span className="inline-flex items-center gap-1 text-xs text-green-600">
                                <CheckIcon className="h-3.5 w-3.5" />
                                Valid
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-xs text-red-600">
                                <XMarkIconSolid className="h-3.5 w-3.5" />
                                {row.error}
                              </span>
                            )}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>

                <div className="mt-3 flex items-center gap-3">
                  <Button
                    type="button"
                    disabled={bulkInviting || csvRows.filter((r) => r.valid).length === 0}
                    onClick={handleBulkInvite}
                  >
                    {bulkInviting ? (
                      <>
                        <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        Sending {bulkProgress?.done}/{bulkProgress?.total}...
                      </>
                    ) : (
                      `Send ${csvRows.filter((r) => r.valid).length} Invite${csvRows.filter((r) => r.valid).length !== 1 ? "s" : ""}`
                    )}
                  </Button>
                  <Button
                    type="button"
                    variant="ghost"
                    disabled={bulkInviting}
                    onClick={() => setCsvRows([])}
                  >
                    Clear
                  </Button>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* ── Member List ────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-white overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-heading">
            Active Members ({memberList.length})
          </h3>
        </div>

        {/* Column headers for team */}
        <div className="hidden sm:flex items-center gap-4 px-5 py-2 border-b border-border bg-gray-50/50 text-xs font-medium text-muted uppercase tracking-wider">
          <div className="w-10" />
          <div className="flex-1">Member</div>
          <div className="w-20 text-center">Role</div>
          <div className="w-32 text-center">Team</div>
          <div className="w-48 text-center">Actions</div>
        </div>

        <div className="divide-y divide-border">
          {memberList.map((member) => {
            const userData = member.publicUserData;
            const firstName = userData?.firstName ?? "";
            const lastName = userData?.lastName ?? "";
            const displayName =
              `${firstName} ${lastName}`.trim() || userData?.identifier || "Unknown";
            const email = userData?.identifier ?? "";
            const avatarUrl = userData?.imageUrl;
            const initial = (firstName || email || "?").charAt(0).toUpperCase();
            const isCurrentAction = actionLoading === member.publicUserData?.userId;
            const userId = member.publicUserData?.userId ?? "";

            return (
              <div
                key={member.id}
                className="flex items-center gap-4 px-5 py-3.5 hover:bg-cream-light/50 transition-colors"
              >
                {/* Avatar */}
                {avatarUrl ? (
                  <img
                    src={avatarUrl}
                    alt={displayName}
                    className="h-10 w-10 rounded-full object-cover"
                  />
                ) : (
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-brand-blue/10 text-sm font-semibold text-brand-blue">
                    {initial}
                  </div>
                )}

                {/* Info */}
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-heading truncate">
                    {displayName}
                  </p>
                  <p className="text-xs text-muted truncate">{email}</p>
                </div>

                {/* Role badge */}
                <Badge
                  variant={
                    member.role === "org:admin" ? "default" : "secondary"
                  }
                >
                  {ROLE_LABELS[member.role] ?? member.role}
                </Badge>

                {/* Team select */}
                <div className="w-32">
                  <select
                    value={teamAssignments[userId] ?? ""}
                    onChange={(e) => handleTeamChange(userId, e.target.value)}
                    className="w-full rounded-md border border-border bg-white px-2 py-1 text-xs text-heading focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-1"
                  >
                    <option value="">No team</option>
                    {teamNames.map((team) => (
                      <option key={team} value={team}>
                        {team}
                      </option>
                    ))}
                  </select>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-2">
                  <Select
                    value={member.role}
                    onValueChange={(val) =>
                      handleRoleChange(
                        member.publicUserData?.userId ?? "",
                        val as RoleOption,
                      )
                    }
                    disabled={isCurrentAction}
                  >
                    <SelectTrigger className="h-7 text-xs min-w-[90px]">
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="org:member">Member</SelectItem>
                      <SelectItem value="org:admin">Admin</SelectItem>
                    </SelectContent>
                  </Select>

                  {confirmRemove === member.publicUserData?.userId ? (
                    <div className="flex items-center gap-1.5">
                      <Button
                        variant="destructive"
                        size="sm"
                        disabled={isCurrentAction}
                        onClick={() =>
                          handleRemoveMember(
                            member.publicUserData?.userId ?? "",
                          )
                        }
                      >
                        {isCurrentAction ? (
                          <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" />
                        ) : (
                          "Confirm"
                        )}
                      </Button>
                      <Button
                        variant="ghost"
                        size="sm"
                        onClick={() => setConfirmRemove(null)}
                      >
                        Cancel
                      </Button>
                    </div>
                  ) : (
                    <button
                      onClick={() =>
                        setConfirmRemove(member.publicUserData?.userId ?? null)
                      }
                      className="rounded-lg p-1.5 text-muted hover:bg-red-50 hover:text-red-600 transition-colors"
                      title="Remove member"
                    >
                      <TrashIcon className="h-4 w-4" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}

          {memberList.length === 0 && (
            <div className="px-5 py-8 text-center text-sm text-muted">
              No members found.
            </div>
          )}
        </div>
      </div>

      {/* ── Pending Invitations ────────────────────────────────────────── */}
      {invitationList.length > 0 && (
        <div className="rounded-xl border border-border bg-white overflow-hidden mb-6">
          <div className="px-5 py-4 border-b border-border">
            <h3 className="text-sm font-semibold text-heading flex items-center gap-2">
              <ClockIcon className="h-4 w-4 text-muted" />
              Pending Invitations ({invitationList.length})
            </h3>
          </div>
          <div className="divide-y divide-border">
            {invitationList.map((invite) => (
              <div
                key={invite.id}
                className="flex items-center gap-4 px-5 py-3.5"
              >
                <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-amber-50 text-sm font-semibold text-amber-600">
                  {(invite.emailAddress ?? "?").charAt(0).toUpperCase()}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-heading truncate">
                    {invite.emailAddress}
                  </p>
                  <p className="text-xs text-muted">
                    Invited{" "}
                    {invite.createdAt
                      ? new Date(invite.createdAt).toLocaleDateString()
                      : ""}
                  </p>
                </div>
                <Badge variant="warning">
                  {ROLE_LABELS[invite.role ?? ""] ?? invite.role}
                </Badge>
                <Badge variant="secondary">{invite.status}</Badge>
                <Button
                  variant="ghost"
                  size="sm"
                  disabled={actionLoading === invite.id}
                  onClick={() => handleRevokeInvitation(invite.id)}
                  className="text-red-600 hover:text-red-700 hover:bg-red-50"
                >
                  {actionLoading === invite.id ? (
                    <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-red-600 border-t-transparent" />
                  ) : (
                    "Revoke"
                  )}
                </Button>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* ── Role Permissions Matrix ──────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-white overflow-hidden">
        <button
          onClick={() => setPermissionsOpen(!permissionsOpen)}
          className="w-full flex items-center justify-between px-5 py-4 text-left hover:bg-cream-light/30 transition-colors"
        >
          <h3 className="text-sm font-semibold text-heading flex items-center gap-2">
            <ShieldCheckIcon className="h-4 w-4 text-brand-blue" />
            Role Permissions
          </h3>
          <ChevronDownIcon
            className={`h-4 w-4 text-muted transition-transform duration-200 ${
              permissionsOpen ? "rotate-180" : ""
            }`}
          />
        </button>

        {permissionsOpen && (
          <div className="border-t border-border">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-border bg-gray-50/50">
                  <th className="px-5 py-3 text-left text-xs font-medium text-muted uppercase tracking-wider">
                    Permission
                  </th>
                  <th className="px-5 py-3 text-center text-xs font-medium text-muted uppercase tracking-wider w-28">
                    Member
                  </th>
                  <th className="px-5 py-3 text-center text-xs font-medium text-muted uppercase tracking-wider w-28">
                    Admin
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-border">
                {PERMISSIONS.map((perm) => (
                  <tr key={perm.label}>
                    <td className="px-5 py-3 text-heading">{perm.label}</td>
                    <td className="px-5 py-3 text-center">
                      {perm.member ? (
                        <CheckCircleIcon className="h-5 w-5 text-green-500 inline-block" />
                      ) : (
                        <XCircleIcon className="h-5 w-5 text-gray-300 inline-block" />
                      )}
                    </td>
                    <td className="px-5 py-3 text-center">
                      {perm.admin ? (
                        <CheckCircleIcon className="h-5 w-5 text-green-500 inline-block" />
                      ) : (
                        <XCircleIcon className="h-5 w-5 text-gray-300 inline-block" />
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <div className="px-5 py-3 border-t border-border bg-gray-50/30">
              <p className="text-xs text-muted">
                This matrix is informational only. Role permissions are enforced server-side.
              </p>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
