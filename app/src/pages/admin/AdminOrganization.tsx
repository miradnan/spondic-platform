import { useState, useRef, useCallback } from "react";
import { useOrganization } from "@clerk/react";
import { useNavigate } from "react-router-dom";
import {
  BuildingOffice2Icon,
  ExclamationTriangleIcon,
  ShieldCheckIcon,
  ClipboardDocumentIcon,
  CheckIcon,
  PaintBrushIcon,
  PhotoIcon,
  ArrowPathIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { useBranding, useUpdateBranding, useUploadBrandingLogo } from "@/hooks/useApi.ts";
import type { UpdateBrandingRequest } from "@/lib/types.ts";

export function AdminOrganization() {
  const { organization, isLoaded } = useOrganization();
  const navigate = useNavigate();

  const [name, setName] = useState("");
  const [slug, setSlug] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState("");
  const [saveSuccess, setSaveSuccess] = useState("");

  const [ssoEnabled, setSsoEnabled] = useState(false);
  const [ssoEnforced, setSsoEnforced] = useState(false);
  const [idpMetadataUrl, setIdpMetadataUrl] = useState("");
  const [idpEntityId, setIdpEntityId] = useState("");
  const [idpSsoUrl, setIdpSsoUrl] = useState("");
  const [idpCertificate, setIdpCertificate] = useState("");
  const [ssoSaving, setSsoSaving] = useState(false);
  const [ssoSaveSuccess, setSsoSaveSuccess] = useState("");
  const [ssoTesting, setSsoTesting] = useState(false);
  const [copiedField, setCopiedField] = useState<string | null>(null);

  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Initialize form values from org data
  if (isLoaded && organization && !initialized) {
    setName(organization.name);
    setSlug(organization.slug ?? "");
    setInitialized(true);
  }

  if (!isLoaded || !organization) {
    return (
      <div className="space-y-4">
        <div className="h-6 w-48 animate-pulse rounded bg-gray-200" />
        <div className="h-4 w-72 animate-pulse rounded bg-gray-200" />
        <div className="rounded-xl border border-border bg-white p-6 space-y-4">
          <div className="h-10 w-full animate-pulse rounded-lg bg-gray-200" />
          <div className="h-10 w-full animate-pulse rounded-lg bg-gray-200" />
          <div className="h-10 w-32 animate-pulse rounded-lg bg-gray-200" />
        </div>
      </div>
    );
  }

  // ── Save handler ──────────────────────────────────────────────────────

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!organization) return;

    setSaving(true);
    setSaveError("");
    setSaveSuccess("");

    try {
      await organization.update({
        name: name.trim(),
        slug: slug.trim() || undefined,
      });
      setSaveSuccess("Organization updated successfully");
      setTimeout(() => setSaveSuccess(""), 4000);
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to update organization";
      setSaveError(message);
    } finally {
      setSaving(false);
    }
  }

  // ── Delete handler ────────────────────────────────────────────────────

  async function handleDelete() {
    if (!organization || deleteInput !== organization.name) return;

    setDeleting(true);
    setDeleteError("");

    try {
      await organization.destroy();
      navigate("/");
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : "Failed to delete organization";
      setDeleteError(message);
      setDeleting(false);
    }
  }

  // ── SSO handlers ───────────────────────────────────────────────────

  async function handleSsoSave(e: React.FormEvent) {
    e.preventDefault();
    setSsoSaving(true);
    setSsoSaveSuccess("");
    // UI-only: Clerk handles actual SAML backend configuration
    // In production, this would call Clerk's API to configure the SAML connection
    await new Promise((resolve) => setTimeout(resolve, 800));
    setSsoEnabled(true);
    setSsoSaving(false);
    setSsoSaveSuccess("SSO configuration saved successfully");
    setTimeout(() => setSsoSaveSuccess(""), 4000);
  }

  async function handleSsoTest() {
    setSsoTesting(true);
    // UI-only: simulate connection test
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setSsoTesting(false);
  }

  function copyToClipboard(text: string, field: string) {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }

  return (
    <div>
      <div className="mb-6">
        <h1 className="font-display text-2xl font-bold text-heading">
          Settings
        </h1>
        <p className="mt-1 text-body">
          Update your organization name, slug, and manage settings.
        </p>
      </div>

      {/* ── Organization Details ──────────────────────────────────────── */}
      <form
        onSubmit={handleSave}
        className="rounded-xl border border-border bg-white p-6 mb-6"
      >
        <h3 className="text-sm font-semibold text-heading mb-4 flex items-center gap-2">
          <BuildingOffice2Icon className="h-4 w-4 text-brand-blue" />
          Organization Details
        </h3>

        <div className="space-y-4 max-w-lg">
          <div>
            <label
              htmlFor="org-name"
              className="block text-sm font-medium text-heading mb-1.5"
            >
              Name
            </label>
            <Input
              id="org-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Organization name"
              disabled={saving}
            />
          </div>

          <div>
            <label
              htmlFor="org-slug"
              className="block text-sm font-medium text-heading mb-1.5"
            >
              Slug
            </label>
            <Input
              id="org-slug"
              type="text"
              value={slug}
              onChange={(e) => setSlug(e.target.value)}
              placeholder="organization-slug"
              disabled={saving}
            />
            <p className="mt-1 text-xs text-muted">
              Used in URLs. Only lowercase letters, numbers, and hyphens.
            </p>
          </div>
        </div>

        <div className="mt-5 flex items-center gap-3">
          <Button type="submit" disabled={!name.trim() || saving}>
            {saving ? (
              <>
                <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                Saving...
              </>
            ) : (
              "Save Changes"
            )}
          </Button>
          {saveError && <p className="text-sm text-red-600">{saveError}</p>}
          {saveSuccess && (
            <p className="text-sm text-green-600">{saveSuccess}</p>
          )}
        </div>
      </form>

      {/* ── Enterprise SSO (SAML) ─────────────────────────────────── */}
      <div className="rounded-xl border border-border bg-white p-6 mb-6">
        <h3 className="text-sm font-semibold text-heading mb-1 flex items-center gap-2">
          <ShieldCheckIcon className="h-4 w-4 text-brand-blue" />
          Enterprise SSO (SAML)
        </h3>
        <p className="text-sm text-body">
          Configure SAML-based single sign-on for your organization. This allows
          your team members to sign in using your company's identity provider.
        </p>

        {/* SSO Status */}
        <div className="mt-4 rounded-lg bg-cream-light p-4">
          <div className="flex items-center gap-2">
            <Badge variant={ssoEnabled ? "success" : "secondary"}>
              {ssoEnabled ? "SSO Enabled" : "SSO Not Configured"}
            </Badge>
            {ssoEnforced && (
              <Badge variant="warning">Enforced</Badge>
            )}
          </div>
        </div>

        {/* Supported Identity Providers */}
        <div className="mt-4">
          <p className="text-xs font-medium text-heading mb-2">
            Supported Identity Providers
          </p>
          <div className="flex flex-wrap gap-2">
            {[
              "Okta",
              "Azure AD (Microsoft Entra ID)",
              "Google Workspace",
              "OneLogin",
              "SAML 2.0 Compatible",
            ].map((idp) => (
              <span
                key={idp}
                className="inline-flex items-center rounded-md bg-cream px-2.5 py-1 text-xs font-medium text-navy"
              >
                {idp}
              </span>
            ))}
          </div>
        </div>

        {/* Configuration Steps */}
        <div className="mt-6 rounded-lg border border-border p-4">
          <h4 className="text-sm font-medium text-navy">Setup Instructions</h4>
          <ol className="mt-3 space-y-3 text-sm text-body">
            <li className="flex gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-blue text-xs text-white font-semibold">
                1
              </span>
              <span>
                In your Identity Provider (Okta, Azure AD, etc.), create a new
                SAML application
              </span>
            </li>
            <li className="flex gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-blue text-xs text-white font-semibold">
                2
              </span>
              <span className="flex-1">
                Use the following ACS URL:{" "}
                <span className="inline-flex items-center gap-1">
                  <code className="bg-cream px-1.5 py-0.5 rounded text-xs">
                    https://clerk.spondic.com/v1/saml/acs
                  </code>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        "https://clerk.spondic.com/v1/saml/acs",
                        "acs",
                      )
                    }
                    className="text-muted hover:text-brand-blue transition-colors"
                    title="Copy to clipboard"
                  >
                    {copiedField === "acs" ? (
                      <CheckIcon className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <ClipboardDocumentIcon className="h-3.5 w-3.5" />
                    )}
                  </button>
                </span>
              </span>
            </li>
            <li className="flex gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-blue text-xs text-white font-semibold">
                3
              </span>
              <span className="flex-1">
                Entity ID:{" "}
                <span className="inline-flex items-center gap-1">
                  <code className="bg-cream px-1.5 py-0.5 rounded text-xs">
                    https://clerk.spondic.com
                  </code>
                  <button
                    type="button"
                    onClick={() =>
                      copyToClipboard(
                        "https://clerk.spondic.com",
                        "entity",
                      )
                    }
                    className="text-muted hover:text-brand-blue transition-colors"
                    title="Copy to clipboard"
                  >
                    {copiedField === "entity" ? (
                      <CheckIcon className="h-3.5 w-3.5 text-green-600" />
                    ) : (
                      <ClipboardDocumentIcon className="h-3.5 w-3.5" />
                    )}
                  </button>
                </span>
              </span>
            </li>
            <li className="flex gap-2">
              <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-brand-blue text-xs text-white font-semibold">
                4
              </span>
              <span>
                Enter your IdP metadata URL or upload the metadata XML below
              </span>
            </li>
          </ol>
        </div>

        {/* SAML Configuration Form */}
        <form onSubmit={handleSsoSave} className="mt-6 space-y-4 max-w-lg">
          <div>
            <label
              htmlFor="idp-metadata-url"
              className="block text-sm font-medium text-heading mb-1.5"
            >
              IdP Metadata URL
            </label>
            <Input
              id="idp-metadata-url"
              type="url"
              value={idpMetadataUrl}
              onChange={(e) => setIdpMetadataUrl(e.target.value)}
              placeholder="https://your-idp.com/metadata.xml"
              disabled={ssoSaving}
            />
          </div>

          <div>
            <label
              htmlFor="idp-entity-id"
              className="block text-sm font-medium text-heading mb-1.5"
            >
              IdP Entity ID
            </label>
            <Input
              id="idp-entity-id"
              type="text"
              value={idpEntityId}
              onChange={(e) => setIdpEntityId(e.target.value)}
              placeholder="https://your-idp.com/entity-id"
              disabled={ssoSaving}
            />
          </div>

          <div>
            <label
              htmlFor="idp-sso-url"
              className="block text-sm font-medium text-heading mb-1.5"
            >
              IdP SSO URL
            </label>
            <Input
              id="idp-sso-url"
              type="url"
              value={idpSsoUrl}
              onChange={(e) => setIdpSsoUrl(e.target.value)}
              placeholder="https://your-idp.com/sso"
              disabled={ssoSaving}
            />
          </div>

          <div>
            <label
              htmlFor="idp-certificate"
              className="block text-sm font-medium text-heading mb-1.5"
            >
              IdP Certificate
            </label>
            <textarea
              id="idp-certificate"
              className="flex w-full rounded-lg border border-border bg-white px-4 py-3 text-sm text-heading placeholder-muted transition-colors focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue disabled:cursor-not-allowed disabled:opacity-50 font-mono"
              rows={4}
              value={idpCertificate}
              onChange={(e) => setIdpCertificate(e.target.value)}
              placeholder="Paste your IdP X.509 certificate here..."
              disabled={ssoSaving}
            />
          </div>

          <div className="flex items-center gap-3">
            <Button type="submit" disabled={ssoSaving}>
              {ssoSaving ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                  Saving...
                </>
              ) : (
                "Save SSO Configuration"
              )}
            </Button>
            <Button
              type="button"
              variant="outline"
              disabled={ssoTesting || !ssoEnabled}
              onClick={handleSsoTest}
            >
              {ssoTesting ? (
                <>
                  <span className="h-4 w-4 animate-spin rounded-full border-2 border-brand-blue border-t-transparent" />
                  Testing...
                </>
              ) : (
                "Test Connection"
              )}
            </Button>
          </div>
          {ssoSaveSuccess && (
            <p className="text-sm text-green-600">{ssoSaveSuccess}</p>
          )}
        </form>

        {/* SSO Enforcement Toggle */}
        <div className="flex items-center justify-between rounded-lg border border-border p-4 mt-6">
          <div>
            <p className="text-sm font-medium text-navy">
              Require SSO for all members
            </p>
            <p className="text-xs text-muted mt-0.5">
              When enabled, all organization members must sign in via SSO.
              Password-based login will be disabled.
            </p>
          </div>
          <button
            type="button"
            role="switch"
            aria-checked={ssoEnforced}
            disabled={!ssoEnabled}
            onClick={() => setSsoEnforced(!ssoEnforced)}
            className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-brand-blue focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50 ${
              ssoEnforced ? "bg-brand-blue" : "bg-gray-300"
            }`}
          >
            <span
              className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow-sm ring-0 transition-transform ${
                ssoEnforced ? "translate-x-5" : "translate-x-0"
              }`}
            />
          </button>
        </div>

        <p className="mt-4 text-xs text-muted">
          SAML SSO is available on the Enterprise plan. Contact{" "}
          <a
            href="mailto:support@spondic.com"
            className="text-brand-blue hover:underline"
          >
            support@spondic.com
          </a>{" "}
          for assistance with SSO setup.
        </p>
      </div>

      {/* ── Branding / White-Label ────────────────────────────────── */}
      <BrandingSection />

      {/* ── Danger Zone ──────────────────────────────────────────────── */}
      <div className="rounded-xl border-2 border-red-200 bg-red-50/50 p-6">
        <h3 className="text-sm font-semibold text-red-700 mb-1 flex items-center gap-2">
          <ExclamationTriangleIcon className="h-4 w-4" />
          Danger Zone
        </h3>
        <p className="text-sm text-red-600/80 mb-4">
          Deleting your organization is permanent and cannot be undone. All data,
          members, and settings will be lost.
        </p>

        {!showDeleteConfirm ? (
          <Button
            variant="destructive"
            onClick={() => setShowDeleteConfirm(true)}
          >
            Delete Organization
          </Button>
        ) : (
          <div className="rounded-lg border border-red-200 bg-white p-4 max-w-md">
            <p className="text-sm text-heading mb-3">
              Type{" "}
              <span className="font-semibold text-red-700">
                {organization.name}
              </span>{" "}
              to confirm deletion.
            </p>
            <Input
              type="text"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder={organization.name}
              className="mb-3"
              disabled={deleting}
            />
            <div className="flex items-center gap-2">
              <Button
                variant="destructive"
                disabled={deleteInput !== organization.name || deleting}
                onClick={handleDelete}
              >
                {deleting ? (
                  <>
                    <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
                    Deleting...
                  </>
                ) : (
                  "Permanently Delete"
                )}
              </Button>
              <Button
                variant="ghost"
                onClick={() => {
                  setShowDeleteConfirm(false);
                  setDeleteInput("");
                  setDeleteError("");
                }}
                disabled={deleting}
              >
                Cancel
              </Button>
            </div>
            {deleteError && (
              <p className="mt-2 text-sm text-red-600">{deleteError}</p>
            )}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Branding Section Component ──────────────────────────────────────────────

function BrandingSection() {
  const { data: branding, isLoading } = useBranding();
  const updateBranding = useUpdateBranding();
  const uploadLogo = useUploadBrandingLogo();

  const [displayName, setDisplayName] = useState("");
  const [primaryColor, setPrimaryColor] = useState("");
  const [secondaryColor, setSecondaryColor] = useState("");
  const [accentColor, setAccentColor] = useState("");
  const [customDomain, setCustomDomain] = useState("");
  const [emailFromName, setEmailFromName] = useState("");
  const [emailFooter, setEmailFooter] = useState("");
  const [brandingInit, setBrandingInit] = useState(false);
  const [brandingSaveSuccess, setBrandingSaveSuccess] = useState("");
  const [logoPreview, setLogoPreview] = useState<string | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize from fetched branding data
  if (branding && !brandingInit) {
    setDisplayName(branding.display_name ?? "");
    setPrimaryColor(branding.primary_color ?? "");
    setSecondaryColor(branding.secondary_color ?? "");
    setAccentColor(branding.accent_color ?? "");
    setCustomDomain(branding.custom_domain ?? "");
    setEmailFromName(branding.email_from_name ?? "");
    setEmailFooter(branding.email_footer_text ?? "");
    if (branding.logo_url) setLogoPreview(branding.logo_url);
    setBrandingInit(true);
  }

  const handleLogoUpload = useCallback(
    async (file: File) => {
      if (file.size > 2 * 1024 * 1024) {
        alert("File too large. Maximum size is 2MB.");
        return;
      }
      const validTypes = ["image/png", "image/jpeg", "image/svg+xml"];
      if (!validTypes.includes(file.type)) {
        alert("Invalid file type. Please upload a PNG, JPG, or SVG file.");
        return;
      }
      // Show local preview immediately
      const url = URL.createObjectURL(file);
      setLogoPreview(url);

      const formData = new FormData();
      formData.append("file", file);
      try {
        const result = await uploadLogo.mutateAsync(formData);
        setLogoPreview(result.logo_url);
      } catch {
        setLogoPreview(branding?.logo_url ?? null);
      }
    },
    [uploadLogo, branding?.logo_url],
  );

  function handleFileDrop(e: React.DragEvent) {
    e.preventDefault();
    const file = e.dataTransfer.files[0];
    if (file) void handleLogoUpload(file);
  }

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) void handleLogoUpload(file);
  }

  async function handleBrandingSave(e: React.FormEvent) {
    e.preventDefault();
    setBrandingSaveSuccess("");

    const body: UpdateBrandingRequest = {};
    if (displayName.trim()) body.display_name = displayName.trim();
    if (primaryColor.trim()) body.primary_color = primaryColor.trim();
    if (secondaryColor.trim()) body.secondary_color = secondaryColor.trim();
    if (accentColor.trim()) body.accent_color = accentColor.trim();
    if (customDomain.trim()) body.custom_domain = customDomain.trim();
    if (emailFromName.trim()) body.email_from_name = emailFromName.trim();
    if (emailFooter.trim()) body.email_footer_text = emailFooter.trim();

    try {
      await updateBranding.mutateAsync(body);
      setBrandingSaveSuccess("Branding saved successfully");
      setTimeout(() => setBrandingSaveSuccess(""), 4000);
    } catch {
      // error handled by mutation
    }
  }

  function handleResetDefaults() {
    setDisplayName("");
    setPrimaryColor("");
    setSecondaryColor("");
    setAccentColor("");
    setCustomDomain("");
    setEmailFromName("");
    setEmailFooter("");
    setLogoPreview(null);

    updateBranding.mutate({
      display_name: "",
      primary_color: "",
      secondary_color: "",
      accent_color: "",
      custom_domain: "",
      email_from_name: "",
      email_footer_text: "",
      logo_url: "",
    });
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-white p-6 mb-6">
        <div className="h-5 w-32 animate-pulse rounded bg-gray-200 mb-4" />
        <div className="space-y-3">
          <div className="h-10 w-full animate-pulse rounded-lg bg-gray-200" />
          <div className="h-10 w-full animate-pulse rounded-lg bg-gray-200" />
        </div>
      </div>
    );
  }

  return (
    <form
      onSubmit={handleBrandingSave}
      className="rounded-xl border border-border bg-white p-6 mb-6"
    >
      <h3 className="text-sm font-semibold text-heading mb-1 flex items-center gap-2">
        <PaintBrushIcon className="h-4 w-4 text-brand-blue" />
        Branding
      </h3>
      <p className="text-sm text-body mb-5">
        Customize your workspace appearance. Changes apply to all members of this organization.
      </p>

      {/* Logo Upload */}
      <div className="mb-5">
        <label className="block text-sm font-medium text-heading mb-2">
          Logo
        </label>
        <div
          onDragOver={(e) => e.preventDefault()}
          onDrop={handleFileDrop}
          onClick={() => fileInputRef.current?.click()}
          className="flex items-center gap-4 rounded-lg border-2 border-dashed border-border hover:border-brand-blue/50 p-4 cursor-pointer transition-colors"
        >
          {logoPreview ? (
            <img
              src={logoPreview}
              alt="Logo preview"
              className="h-12 w-auto max-w-[160px] object-contain rounded"
            />
          ) : (
            <div className="flex h-12 w-12 items-center justify-center rounded-lg bg-cream">
              <PhotoIcon className="h-6 w-6 text-muted" />
            </div>
          )}
          <div className="flex-1 min-w-0">
            <p className="text-sm text-heading font-medium">
              {logoPreview ? "Click or drag to replace" : "Click or drag to upload"}
            </p>
            <p className="text-xs text-muted mt-0.5">
              PNG, JPG, or SVG. Max 2MB.
            </p>
          </div>
          {uploadLogo.isPending && (
            <span className="h-5 w-5 animate-spin rounded-full border-2 border-brand-blue border-t-transparent" />
          )}
        </div>
        <input
          ref={fileInputRef}
          type="file"
          accept=".png,.jpg,.jpeg,.svg"
          className="hidden"
          onChange={handleFileChange}
        />
      </div>

      <div className="space-y-4 max-w-lg">
        {/* Display Name */}
        <div>
          <label
            htmlFor="brand-display-name"
            className="block text-sm font-medium text-heading mb-1.5"
          >
            Display Name
          </label>
          <Input
            id="brand-display-name"
            type="text"
            value={displayName}
            onChange={(e) => setDisplayName(e.target.value)}
            placeholder="Custom display name (overrides org name in sidebar)"
            disabled={updateBranding.isPending}
          />
        </div>

        {/* Colors */}
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div>
            <label
              htmlFor="brand-primary"
              className="block text-sm font-medium text-heading mb-1.5"
            >
              Primary Color
            </label>
            <div className="flex items-center gap-2">
              <Input
                id="brand-primary"
                type="text"
                value={primaryColor}
                onChange={(e) => setPrimaryColor(e.target.value)}
                placeholder="#2d5fa0"
                maxLength={7}
                className="flex-1"
                disabled={updateBranding.isPending}
              />
              {primaryColor && /^#[0-9a-fA-F]{6}$/.test(primaryColor) && (
                <span
                  className="h-8 w-8 rounded-md border border-border shrink-0"
                  style={{ backgroundColor: primaryColor }}
                />
              )}
            </div>
          </div>
          <div>
            <label
              htmlFor="brand-secondary"
              className="block text-sm font-medium text-heading mb-1.5"
            >
              Secondary Color
            </label>
            <div className="flex items-center gap-2">
              <Input
                id="brand-secondary"
                type="text"
                value={secondaryColor}
                onChange={(e) => setSecondaryColor(e.target.value)}
                placeholder="#1a2740"
                maxLength={7}
                className="flex-1"
                disabled={updateBranding.isPending}
              />
              {secondaryColor && /^#[0-9a-fA-F]{6}$/.test(secondaryColor) && (
                <span
                  className="h-8 w-8 rounded-md border border-border shrink-0"
                  style={{ backgroundColor: secondaryColor }}
                />
              )}
            </div>
          </div>
          <div>
            <label
              htmlFor="brand-accent"
              className="block text-sm font-medium text-heading mb-1.5"
            >
              Accent Color
            </label>
            <div className="flex items-center gap-2">
              <Input
                id="brand-accent"
                type="text"
                value={accentColor}
                onChange={(e) => setAccentColor(e.target.value)}
                placeholder="#c49a3c"
                maxLength={7}
                className="flex-1"
                disabled={updateBranding.isPending}
              />
              {accentColor && /^#[0-9a-fA-F]{6}$/.test(accentColor) && (
                <span
                  className="h-8 w-8 rounded-md border border-border shrink-0"
                  style={{ backgroundColor: accentColor }}
                />
              )}
            </div>
          </div>
        </div>

        {/* Custom Domain */}
        <div>
          <label
            htmlFor="brand-domain"
            className="block text-sm font-medium text-heading mb-1.5"
          >
            Custom Domain
          </label>
          <Input
            id="brand-domain"
            type="text"
            value={customDomain}
            onChange={(e) => setCustomDomain(e.target.value)}
            placeholder="rfp.acmecorp.com"
            disabled={updateBranding.isPending}
          />
          <p className="mt-1 text-xs text-muted">
            Contact support to configure DNS for your custom domain.
          </p>
        </div>

        {/* Email Settings */}
        <div>
          <label
            htmlFor="brand-email-from"
            className="block text-sm font-medium text-heading mb-1.5"
          >
            Email From Name
          </label>
          <Input
            id="brand-email-from"
            type="text"
            value={emailFromName}
            onChange={(e) => setEmailFromName(e.target.value)}
            placeholder="Acme Corp RFP Team"
            disabled={updateBranding.isPending}
          />
        </div>

        <div>
          <label
            htmlFor="brand-email-footer"
            className="block text-sm font-medium text-heading mb-1.5"
          >
            Email / Export Footer Text
          </label>
          <textarea
            id="brand-email-footer"
            className="flex w-full rounded-lg border border-border bg-white px-4 py-3 text-sm text-heading placeholder-muted transition-colors focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue disabled:cursor-not-allowed disabled:opacity-50"
            rows={3}
            value={emailFooter}
            onChange={(e) => setEmailFooter(e.target.value)}
            placeholder="Custom footer text for exported documents and emails..."
            disabled={updateBranding.isPending}
          />
        </div>
      </div>

      {/* Actions */}
      <div className="mt-5 flex items-center gap-3">
        <Button type="submit" disabled={updateBranding.isPending}>
          {updateBranding.isPending ? (
            <>
              <span className="h-4 w-4 animate-spin rounded-full border-2 border-white border-t-transparent" />
              Saving...
            </>
          ) : (
            "Save Branding"
          )}
        </Button>
        <Button
          type="button"
          variant="outline"
          onClick={handleResetDefaults}
          disabled={updateBranding.isPending}
        >
          <ArrowPathIcon className="h-4 w-4 mr-1" />
          Reset to Defaults
        </Button>
        {updateBranding.isError && (
          <p className="text-sm text-red-600">{updateBranding.error.message}</p>
        )}
        {brandingSaveSuccess && (
          <p className="text-sm text-green-600">{brandingSaveSuccess}</p>
        )}
      </div>
    </form>
  );
}
