import { useState, useEffect, useRef } from "react";
import {
  UserGroupIcon,
  PlusIcon,
  TrashIcon,
  PencilIcon,
  CheckIcon,
  XMarkIcon,
  UserPlusIcon,

} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  useTeams,
  useCreateTeam,
  useUpdateTeam,
  useDeleteTeam,
  useSeedDefaultTeams,
  useTeamMembers,
  useAddTeamMember,
  useRemoveTeamMember,
  useSearchUsers,
} from "@/hooks/useApi";
import type { Team } from "@/lib/types";

export function AdminTeams() {
  const [newTeamName, setNewTeamName] = useState("");
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editName, setEditName] = useState("");
  const [expandedTeamId, setExpandedTeamId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [toast, setToast] = useState<{ message: string; type: "success" | "error" } | null>(null);
  const editInputRef = useRef<HTMLInputElement>(null);

  const { data: teamsData, isLoading } = useTeams();
  const seedMutation = useSeedDefaultTeams();
  const createMutation = useCreateTeam();
  const updateMutation = useUpdateTeam();
  const deleteMutation = useDeleteTeam();

  const teams = teamsData?.teams ?? [];

  // Seed default teams on mount
  useEffect(() => {
    seedMutation.mutate(undefined, {
      onError: () => {
        // Seeding failed silently — teams may already exist
      },
    });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Focus edit input when editing starts
  useEffect(() => {
    if (editingId && editInputRef.current) {
      editInputRef.current.focus();
      editInputRef.current.select();
    }
  }, [editingId]);

  // Auto-dismiss toast
  useEffect(() => {
    if (!toast) return;
    const t = setTimeout(() => setToast(null), 3000);
    return () => clearTimeout(t);
  }, [toast]);

  function showToast(message: string, type: "success" | "error" = "success") {
    setToast({ message, type });
  }

  function handleCreate() {
    const name = newTeamName.trim();
    if (!name) return;
    createMutation.mutate(
      { name },
      {
        onSuccess: () => {
          setNewTeamName("");
          showToast(`Team "${name}" created`);
        },
        onError: (err) => showToast(err.message, "error"),
      },
    );
  }

  function startEdit(team: Team) {
    setEditingId(team.id);
    setEditName(team.name);
  }

  function saveEdit() {
    if (!editingId) return;
    const name = editName.trim();
    if (!name) {
      setEditingId(null);
      return;
    }
    updateMutation.mutate(
      { id: editingId, name },
      {
        onSuccess: () => {
          setEditingId(null);
          showToast("Team renamed");
        },
        onError: (err) => showToast(err.message, "error"),
      },
    );
  }

  function cancelEdit() {
    setEditingId(null);
    setEditName("");
  }

  function handleDelete(id: string) {
    deleteMutation.mutate(id, {
      onSuccess: () => {
        setDeletingId(null);
        if (expandedTeamId === id) setExpandedTeamId(null);
        showToast("Team deleted");
      },
      onError: (err) => {
        setDeletingId(null);
        showToast(err.message, "error");
      },
    });
  }

  function toggleExpand(id: string) {
    setExpandedTeamId((prev) => (prev === id ? null : id));
  }

  // ── Loading skeleton ────────────────────────────────────────────────────────

  if (isLoading) {
    return (
      <div>
        <div className="mb-6">
          <div className="h-6 w-24 bg-surface-inset rounded animate-pulse" />
          <div className="h-4 w-64 bg-surface-inset rounded animate-pulse mt-2" />
        </div>
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <div
              key={i}
              className="flex items-center gap-4 rounded-xl border border-border bg-surface p-4"
            >
              <div className="h-10 w-10 bg-surface-inset rounded-lg animate-pulse" />
              <div className="flex-1 space-y-2">
                <div className="h-4 w-24 bg-surface-inset rounded animate-pulse" />
                <div className="h-3 w-16 bg-surface-inset rounded animate-pulse" />
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // ── Main render ─────────────────────────────────────────────────────────────

  return (
    <div>
      {/* Toast notification */}
      {toast && (
        <div
          className={`fixed top-4 right-4 z-50 rounded-lg px-4 py-3 text-sm font-medium shadow-lg transition-all ${
            toast.type === "success"
              ? "bg-green-50 dark:bg-green-900/30 text-green-800 dark:text-green-300 border border-green-200 dark:border-green-800"
              : "bg-red-50 dark:bg-red-900/30 text-red-800 dark:text-red-300 border border-red-200 dark:border-red-800"
          }`}
        >
          {toast.message}
        </div>
      )}

      <div className="mb-6">
        <div className="flex items-center gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-blue/10">
            <UserGroupIcon className="h-5 w-5 text-brand-blue" />
          </div>
          <div>
            <h1 className="font-display text-2xl font-bold text-heading">Teams</h1>
            <p className="text-sm text-body">
              Organize members into teams for streamlined RFP collaboration.
            </p>
          </div>
        </div>
      </div>

      {/* Create new team */}
      <div className="flex items-center gap-3 mb-6">
        <Input
          placeholder="New team name..."
          value={newTeamName}
          onChange={(e) => setNewTeamName(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === "Enter") handleCreate();
          }}
          className="max-w-sm"
        />
        <Button
          onClick={handleCreate}
          disabled={!newTeamName.trim() || createMutation.isPending}
        >
          <PlusIcon className="h-4 w-4" />
          {createMutation.isPending ? "Creating..." : "Create Team"}
        </Button>
      </div>

      {/* Teams grid */}
      {teams.length > 0 ? (
        <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          {teams.map((team) => (
            <div key={team.id}>
              <div
                className={`group flex items-center gap-4 rounded-xl border bg-surface p-4 transition-all hover:shadow-md cursor-pointer ${
                  expandedTeamId === team.id
                    ? "border-brand-blue shadow-md"
                    : "border-border"
                }`}
                onClick={() => toggleExpand(team.id)}
              >
                <div className="rounded-lg bg-brand-blue/10 p-2.5 text-brand-blue">
                  <UserGroupIcon className="h-5 w-5" />
                </div>
                <div className="flex-1 min-w-0">
                  {editingId === team.id ? (
                    <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                      <input
                        ref={editInputRef}
                        type="text"
                        value={editName}
                        onChange={(e) => setEditName(e.target.value)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") saveEdit();
                          if (e.key === "Escape") cancelEdit();
                        }}
                        onBlur={saveEdit}
                        className="flex-1 min-w-0 rounded border border-brand-blue bg-surface px-2 py-0.5 text-sm text-heading focus:outline-none focus:ring-1 focus:ring-brand-blue"
                      />
                      <button
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={saveEdit}
                        className="p-1 text-green-600 hover:bg-green-50 dark:hover:bg-green-900/30 rounded"
                      >
                        <CheckIcon className="h-3.5 w-3.5" />
                      </button>
                      <button
                        onMouseDown={(e) => e.preventDefault()}
                        onClick={(e) => {
                          e.stopPropagation();
                          cancelEdit();
                        }}
                        className="p-1 text-muted hover:bg-cream-light rounded"
                      >
                        <XMarkIcon className="h-3.5 w-3.5" />
                      </button>
                    </div>
                  ) : (
                    <>
                      <p className="text-sm font-medium text-heading truncate">
                        {team.name}
                      </p>
                      <div className="flex items-center gap-2 mt-0.5">
                        <Badge variant={team.member_count > 0 ? "default" : "secondary"}>
                          {team.member_count} member{team.member_count !== 1 ? "s" : ""}
                        </Badge>
                      </div>
                    </>
                  )}
                </div>

                {/* Action buttons */}
                {editingId !== team.id && (
                  <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                    <button
                      onClick={(e) => {
                        e.stopPropagation();
                        startEdit(team);
                      }}
                      className="rounded-lg p-1.5 text-muted hover:bg-brand-blue/10 hover:text-brand-blue transition-colors"
                      title="Rename team"
                    >
                      <PencilIcon className="h-4 w-4" />
                    </button>
                    {deletingId === team.id ? (
                      <div className="flex items-center gap-1" onClick={(e) => e.stopPropagation()}>
                        <button
                          onClick={() => handleDelete(team.id)}
                          className="rounded-lg p-1.5 text-red-600 hover:bg-red-50 dark:hover:bg-red-900/30 transition-colors"
                          title="Confirm delete"
                        >
                          <CheckIcon className="h-4 w-4" />
                        </button>
                        <button
                          onClick={() => setDeletingId(null)}
                          className="rounded-lg p-1.5 text-muted hover:bg-cream-light transition-colors"
                          title="Cancel"
                        >
                          <XMarkIcon className="h-4 w-4" />
                        </button>
                      </div>
                    ) : (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          setDeletingId(team.id);
                        }}
                        className="rounded-lg p-1.5 text-muted hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 transition-colors"
                        title={`Delete ${team.name}`}
                      >
                        <TrashIcon className="h-4 w-4" />
                      </button>
                    )}
                  </div>
                )}
              </div>

              {/* Expanded members section */}
              {expandedTeamId === team.id && (
                <TeamMembersPanel
                  teamId={team.id}
                  teamName={team.name}
                  showToast={showToast}
                />
              )}
            </div>
          ))}
        </div>
      ) : (
        <div className="rounded-xl border border-border bg-surface p-8 text-center">
          <UserGroupIcon className="mx-auto h-10 w-10 text-muted mb-3" />
          <p className="text-sm text-muted">
            No teams yet. Create one to get started.
          </p>
        </div>
      )}
    </div>
  );
}

// ── TeamMembersPanel ──────────────────────────────────────────────────────────

interface TeamMembersPanelProps {
  teamId: string;
  teamName: string;
  showToast: (message: string, type?: "success" | "error") => void;
}

function TeamMembersPanel({
  teamId,
  teamName,
  showToast,
}: TeamMembersPanelProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [debouncedQuery, setDebouncedQuery] = useState("");
  const [isDropdownOpen, setIsDropdownOpen] = useState(false);
  const comboboxRef = useRef<HTMLDivElement>(null);
  const searchInputRef = useRef<HTMLInputElement>(null);

  const { data: membersData, isLoading } = useTeamMembers(teamId);
  const addMemberMutation = useAddTeamMember();
  const removeMemberMutation = useRemoveTeamMember();
  const { data: searchResults, isLoading: isSearching } = useSearchUsers(debouncedQuery);

  const members = membersData?.members ?? [];
  const memberUserIds = new Set(members.map((m) => m.user_id));

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  // Open dropdown when we have results
  useEffect(() => {
    if (debouncedQuery.length >= 2) {
      setIsDropdownOpen(true);
    }
  }, [debouncedQuery]);

  // Close dropdown on click outside
  useEffect(() => {
    function handleClickOutside(e: MouseEvent) {
      if (comboboxRef.current && !comboboxRef.current.contains(e.target as Node)) {
        setIsDropdownOpen(false);
      }
    }
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  function handleSelectUser(userId: string) {
    addMemberMutation.mutate(
      { teamId, userId },
      {
        onSuccess: () => {
          setSearchQuery("");
          setDebouncedQuery("");
          setIsDropdownOpen(false);
          showToast(`Member added to ${teamName}`);
        },
        onError: (err) => showToast(err.message, "error"),
      },
    );
  }

  function handleRemoveMember(userId: string) {
    removeMemberMutation.mutate(
      { teamId, userId },
      {
        onSuccess: () => showToast("Member removed"),
        onError: (err) => showToast(err.message, "error"),
      },
    );
  }

  // Filter out users who are already members
  const filteredResults = (searchResults ?? []).filter((u) => !memberUserIds.has(u.id));

  return (
    <div className="mt-1 ml-4 rounded-xl border border-border bg-cream-light/50 p-4">
      <h4 className="text-xs font-semibold text-muted uppercase tracking-wider mb-3">
        Members
      </h4>

      {/* Add member — searchable combobox */}
      <div ref={comboboxRef} className="relative mb-3">
        <div className="flex items-center gap-2">
          <div className="relative flex-1">
            <input
              ref={searchInputRef}
              type="text"
              autoComplete="off"
              autoCorrect="off"
              autoCapitalize="off"
              spellCheck={false}
              placeholder="Search by name or email..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              onFocus={() => {
                if (debouncedQuery.length >= 2) setIsDropdownOpen(true);
              }}
              className="w-full rounded-md border border-border bg-surface px-3 py-1.5 text-xs text-heading placeholder:text-muted focus:outline-none focus:ring-2 focus:ring-brand-blue/40 focus:border-brand-blue"
            />
            {isSearching && (
              <div className="absolute right-2 top-1/2 -translate-y-1/2">
                <div className="h-3.5 w-3.5 border-2 border-brand-blue/30 border-t-brand-blue rounded-full animate-spin" />
              </div>
            )}
          </div>
        </div>

        {/* Dropdown results */}
        {isDropdownOpen && debouncedQuery.length >= 2 && (
          <div className="absolute z-20 mt-1 w-full rounded-lg border border-border bg-surface shadow-lg max-h-48 overflow-y-auto">
            {isSearching ? (
              <div className="px-3 py-3 text-xs text-muted text-center">
                Searching...
              </div>
            ) : filteredResults.length > 0 ? (
              <ul>
                {filteredResults.map((user) => (
                  <li key={user.id}>
                    <button
                      type="button"
                      onClick={() => handleSelectUser(user.id)}
                      disabled={addMemberMutation.isPending}
                      className="w-full flex items-center gap-2.5 px-3 py-2 text-left hover:bg-brand-blue/5 transition-colors disabled:opacity-50"
                    >
                      {user.image_url ? (
                        <img
                          src={user.image_url}
                          alt=""
                          className="h-6 w-6 rounded-full object-cover shrink-0"
                        />
                      ) : (
                        <div className="h-6 w-6 rounded-full bg-brand-blue/10 text-brand-blue flex items-center justify-center text-[10px] font-semibold shrink-0">
                          {(user.first_name?.[0] ?? "").toUpperCase()}
                          {(user.last_name?.[0] ?? "").toUpperCase()}
                        </div>
                      )}
                      <div className="min-w-0 flex-1">
                        <p className="text-xs font-medium text-heading truncate">
                          {[user.first_name, user.last_name].filter(Boolean).join(" ") || "Unnamed"}
                        </p>
                        {user.email && (
                          <p className="text-[10px] text-muted truncate">{user.email}</p>
                        )}
                      </div>
                      <UserPlusIcon className="h-3.5 w-3.5 text-muted shrink-0" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : (
              <div className="px-3 py-3 text-xs text-muted text-center">
                No users found
              </div>
            )}
          </div>
        )}
      </div>

      {/* Members list */}
      {isLoading ? (
        <div className="space-y-2">
          {[1, 2].map((i) => (
            <div key={i} className="h-8 bg-surface-inset rounded animate-pulse" />
          ))}
        </div>
      ) : members.length > 0 ? (
        <ul className="space-y-1.5">
          {members.map((m) => (
            <li
              key={m.user_id}
              className="flex items-center gap-2.5 rounded-lg bg-surface border border-border px-3 py-2 text-xs"
            >
              {m.image_url ? (
                <img src={m.image_url} alt="" className="h-6 w-6 rounded-full object-cover shrink-0" />
              ) : (
                <div className="h-6 w-6 rounded-full bg-brand-blue/10 text-brand-blue flex items-center justify-center text-[10px] font-semibold shrink-0">
                  {(m.first_name?.[0] ?? "").toUpperCase()}{(m.last_name?.[0] ?? "").toUpperCase()}
                </div>
              )}
              <div className="flex-1 min-w-0">
                <p className="text-xs font-medium text-heading truncate">
                  {[m.first_name, m.last_name].filter(Boolean).join(" ") || m.user_id}
                </p>
                {m.email && (
                  <p className="text-[10px] text-muted truncate">{m.email}</p>
                )}
              </div>
              <button
                onClick={() => handleRemoveMember(m.user_id)}
                className="shrink-0 rounded p-1 text-muted hover:bg-red-50 dark:hover:bg-red-900/30 hover:text-red-600 transition-colors"
                title="Remove member"
              >
                <TrashIcon className="h-3.5 w-3.5" />
              </button>
            </li>
          ))}
        </ul>
      ) : (
        <p className="text-xs text-muted py-2 text-center">
          No members yet. Search for users above to add them.
        </p>
      )}
    </div>
  );
}
