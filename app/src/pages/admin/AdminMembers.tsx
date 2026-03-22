import { useState } from "react";
import { useOrganization } from "@clerk/react";
import {
  EnvelopeIcon,
  TrashIcon,
  ClockIcon,
  XMarkIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Select, SelectTrigger, SelectValue, SelectContent, SelectItem } from "@/components/ui/select";

// ── Types ────────────────────────────────────────────────────────────────────

type RoleOption = "org:admin" | "org:member";

const ROLE_LABELS: Record<string, string> = {
  "org:admin": "Admin",
  "org:member": "Member",
};

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

  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteRole, setInviteRole] = useState<RoleOption>("org:member");
  const [inviting, setInviting] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");

  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [actionError, setActionError] = useState("");

  const [confirmRemove, setConfirmRemove] = useState<string | null>(null);

  if (!isLoaded || !organization) {
    return (
      <div className="space-y-4">
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
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-heading">Members</h1>
        <p className="mt-1 text-body">
          Invite new members, manage roles, and view pending invitations.
        </p>
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
        </form>
        {inviteError && (
          <p className="mt-2 text-sm text-red-600">{inviteError}</p>
        )}
        {inviteSuccess && (
          <p className="mt-2 text-sm text-green-600">{inviteSuccess}</p>
        )}
      </div>

      {/* ── Member List ────────────────────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-white overflow-hidden mb-6">
        <div className="px-5 py-4 border-b border-border">
          <h3 className="text-sm font-semibold text-heading">
            Active Members ({memberList.length})
          </h3>
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
        <div className="rounded-xl border border-border bg-white overflow-hidden">
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
    </div>
  );
}
