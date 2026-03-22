import { useState } from "react";
import {
  useOrganization,
  useOrganizationList,
} from "@clerk/react";
import { useTranslation } from "react-i18next";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { BuildingOffice2Icon } from "@heroicons/react/24/outline";

export function OrgGate({ children }: { children: React.ReactNode }) {
  const { t } = useTranslation();
  const { organization, isLoaded } = useOrganization();
  const {
    userMemberships,
    createOrganization,
    setActive,
    isLoaded: listLoaded,
  } = useOrganizationList({ userMemberships: { infinite: true } });

  const [orgName, setOrgName] = useState("");
  const [creating, setCreating] = useState(false);
  const [switching, setSwitching] = useState<string | null>(null);
  const [error, setError] = useState("");

  if (!isLoaded || !listLoaded) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-cream">
        <div className="h-8 w-8 animate-spin rounded-full border-4 border-navy border-t-transparent" />
      </div>
    );
  }

  if (!organization) {
    const otherOrgs = userMemberships?.data ?? [];

    async function handleCreate(e: React.FormEvent) {
      e.preventDefault();
      const name = orgName.trim();
      if (!name || !createOrganization || !setActive) return;

      setCreating(true);
      setError("");
      try {
        const org = await createOrganization({ name });
        await setActive({ organization: org });
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to create workspace";
        setError(message);
      } finally {
        setCreating(false);
      }
    }

    async function handleSwitch(orgId: string) {
      if (!setActive) return;
      setSwitching(orgId);
      setError("");
      try {
        await setActive({ organization: orgId });
      } catch (err: unknown) {
        const message =
          err instanceof Error ? err.message : "Failed to switch workspace";
        setError(message);
        setSwitching(null);
      }
    }

    return (
      <div className="flex min-h-screen items-center justify-center bg-cream px-4">
        <div className="w-full max-w-md">
          {/* Header */}
          <div className="text-center mb-8">
            <div className="mx-auto mb-4 flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-blue/10">
              <BuildingOffice2Icon className="h-7 w-7 text-brand-blue" />
            </div>
            <h1 className="font-heading text-3xl font-bold text-navy">
              {t("orgGate.welcome", { name: import.meta.env.VITE_BUSINESS_NAME ?? "Spondic" })}
            </h1>
            <p className="mt-2 text-sm text-navy/70 leading-relaxed">
              {t("orgGate.subtitle")}
            </p>
          </div>

          {/* Create form */}
          <form
            onSubmit={handleCreate}
            className="rounded-xl border border-border bg-white p-6 shadow-sm"
          >
            <label
              htmlFor="org-name"
              className="block text-sm font-medium text-heading mb-1.5"
            >
              {t("orgGate.orgName")}
            </label>
            <Input
              id="org-name"
              type="text"
              placeholder={t("orgGate.orgNamePlaceholder")}
              value={orgName}
              onChange={(e) => setOrgName(e.target.value)}
              disabled={creating}
              autoFocus
            />
            <Button
              type="submit"
              className="w-full mt-4"
              disabled={!orgName.trim() || creating}
            >
              {creating ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  {t("orgGate.creating")}
                </>
              ) : (
                t("orgGate.createWorkspace")
              )}
            </Button>

            {error && (
              <p className="mt-3 text-sm text-red-600 text-center">{error}</p>
            )}
          </form>

          {/* Existing orgs */}
          {otherOrgs.length > 0 && (
            <div className="mt-6">
              <div className="flex items-center gap-3 mb-4">
                <div className="h-px flex-1 bg-navy/10" />
                <span className="text-xs text-navy/50 uppercase tracking-wider font-medium">
                  {t("orgGate.joinExisting")}
                </span>
                <div className="h-px flex-1 bg-navy/10" />
              </div>
              <div className="space-y-2">
                {otherOrgs.map((membership) => {
                  const org = membership.organization;
                  return (
                  <div
                    key={org.id}
                    className="flex items-center gap-3 rounded-xl border border-border bg-white px-4 py-3"
                  >
                    <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-navy/10 text-sm font-semibold text-navy">
                      {org.name.charAt(0).toUpperCase()}
                    </div>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium text-heading truncate">
                        {org.name}
                      </p>
                      <p className="text-xs text-muted capitalize">
                        {membership.role.replace("org:", "")}
                      </p>
                    </div>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={switching === org.id}
                      onClick={() => handleSwitch(org.id)}
                    >
                      {switching === org.id ? (
                        <span className="h-3.5 w-3.5 animate-spin rounded-full border-2 border-brand-blue border-t-transparent" />
                      ) : (
                        t("orgGate.switch")
                      )}
                    </Button>
                  </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      </div>
    );
  }

  return <>{children}</>;
}
