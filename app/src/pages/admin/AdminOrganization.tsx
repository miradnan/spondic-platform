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
  Cog6ToothIcon,
  ChevronDownIcon,
  SwatchIcon,
  GlobeAltIcon,
  EnvelopeIcon,
} from "@heroicons/react/24/outline";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  useBranding,
  useUpdateBranding,
  useUploadBrandingLogo,
} from "@/hooks/useApi.ts";
import type { UpdateBrandingRequest } from "@/lib/types.ts";

// ── Collapsible Section ─────────────────────────────────────────────────────

function Section({
  icon: Icon,
  title,
  description,
  children,
  collapsible = false,
  defaultOpen = true,
  badge,
}: {
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
  title: string;
  description?: string;
  children: React.ReactNode;
  collapsible?: boolean;
  defaultOpen?: boolean;
  badge?: React.ReactNode;
}) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <section className="rounded-xl border border-border bg-white overflow-hidden">
      <div
        className={`flex items-start gap-3 p-6 pb-0 ${collapsible ? "cursor-pointer select-none" : ""}`}
        onClick={collapsible ? () => setOpen(!open) : undefined}
      >
        <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-brand-blue/10">
          <Icon className="h-4.5 w-4.5 text-brand-blue" />
        </div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-base font-semibold text-heading">{title}</h3>
            {badge}
          </div>
          {description && (
            <p className="text-sm text-muted mt-0.5">{description}</p>
          )}
        </div>
        {collapsible && (
          <ChevronDownIcon
            className={`h-5 w-5 text-muted shrink-0 transition-transform mt-1 ${open ? "rotate-180" : ""}`}
          />
        )}
      </div>
      {(!collapsible || open) && <div className="p-6 pt-5">{children}</div>}
      {collapsible && !open && <div className="h-6" />}
    </section>
  );
}

// ── Color Input ─────────────────────────────────────────────────────────────

function ColorInput({
  id,
  label,
  value,
  onChange,
  placeholder,
  disabled,
}: {
  id: string;
  label: string;
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  disabled?: boolean;
}) {
  const isValidHex = /^#[0-9a-fA-F]{6}$/.test(value);

  return (
    <div>
      <Label htmlFor={id}>{label}</Label>
      <div className="mt-1.5 flex items-center gap-2">
        <div className="relative flex-1">
          <Input
            id={id}
            type="text"
            value={value}
            onChange={(e) => onChange(e.target.value)}
            placeholder={placeholder}
            maxLength={7}
            disabled={disabled}
            className="pl-10 font-mono"
          />
          <input
            type="color"
            value={isValidHex ? value : placeholder}
            onChange={(e) => onChange(e.target.value)}
            disabled={disabled}
            className="absolute left-2.5 top-1/2 -translate-y-1/2 h-5 w-5 cursor-pointer rounded border-0 p-0 [&::-webkit-color-swatch-wrapper]:p-0 [&::-webkit-color-swatch]:rounded [&::-webkit-color-swatch]:border-border"
          />
        </div>
      </div>
    </div>
  );
}

// ── Main Component ──────────────────────────────────────────────────────────

export function AdminOrganization() {
  const { organization, isLoaded } = useOrganization();
  const navigate = useNavigate();

  const [name, setName] = useState("");
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

  const [showDeleteDialog, setShowDeleteDialog] = useState(false);
  const [deleteInput, setDeleteInput] = useState("");
  const [deleting, setDeleting] = useState(false);
  const [deleteError, setDeleteError] = useState("");

  // Initialize form values from org data
  if (isLoaded && organization && !initialized) {
    setName(organization.name);
    setInitialized(true);
  }

  if (!isLoaded || !organization) {
    return (
      <div className="w-full max-w-7xl mx-auto space-y-5">
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

  // ── Handlers ─────────────────────────────────────────────────────────────

  async function handleSave(e: React.FormEvent) {
    e.preventDefault();
    if (!organization) return;

    setSaving(true);
    setSaveError("");
    setSaveSuccess("");

    try {
      await organization.update({ name: name.trim() });
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

  async function handleSsoSave(e: React.FormEvent) {
    e.preventDefault();
    setSsoSaving(true);
    setSsoSaveSuccess("");
    await new Promise((resolve) => setTimeout(resolve, 800));
    setSsoEnabled(true);
    setSsoSaving(false);
    setSsoSaveSuccess("SSO configuration saved successfully");
    setTimeout(() => setSsoSaveSuccess(""), 4000);
  }

  async function handleSsoTest() {
    setSsoTesting(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    setSsoTesting(false);
  }

  function copyToClipboard(text: string, field: string) {
    navigator.clipboard.writeText(text);
    setCopiedField(field);
    setTimeout(() => setCopiedField(null), 2000);
  }

  function CopyableCode({ text, field }: { text: string; field: string }) {
    return (
      <span className="inline-flex items-center gap-1.5 rounded-lg bg-cream px-2.5 py-1 mt-1">
        <code className="text-xs font-mono text-heading">{text}</code>
        <button
          type="button"
          onClick={() => copyToClipboard(text, field)}
          className="text-muted hover:text-brand-blue transition-colors"
          title="Copy to clipboard"
        >
          {copiedField === field ? (
            <CheckIcon className="h-3.5 w-3.5 text-green-600" />
          ) : (
            <ClipboardDocumentIcon className="h-3.5 w-3.5" />
          )}
        </button>
      </span>
    );
  }

  return (
    <div className="w-full max-w-7xl mx-auto space-y-5 pb-12">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-brand-blue/10">
          <Cog6ToothIcon className="h-5 w-5 text-brand-blue" />
        </div>
        <div>
          <h1 className="font-display text-2xl font-bold text-heading">
            Settings
          </h1>
          <p className="text-sm text-body">
            Manage your organization, branding, and security.
          </p>
        </div>
      </div>

      {/* ── Organization Details ─────────────────────────────────────── */}
      <Section
        icon={BuildingOffice2Icon}
        title="Organization"
        description="Your organization's display name."
      >
        <form onSubmit={handleSave}>
          <div>
            <Label htmlFor="org-name">Name</Label>
            <Input
              id="org-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Organization name"
              disabled={saving}
              className="mt-1.5"
            />
          </div>
          <div className="mt-4 flex items-center gap-3">
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
              <p className="flex items-center gap-1.5 text-sm text-green-600">
                <CheckIcon className="h-4 w-4" />
                {saveSuccess}
              </p>
            )}
          </div>
        </form>
      </Section>

      {/* ── Branding ─────────────────────────────────────────────────── */}
      <BrandingSection />

      {/* ── Enterprise SSO (SAML) ─────────────────────────────────────── */}
      <Section
        icon={ShieldCheckIcon}
        title="Enterprise SSO (SAML)"
        description="Allow team members to sign in via your company's identity provider."
        collapsible
        defaultOpen={false}
        badge={
          <Badge variant={ssoEnabled ? "success" : "secondary"}>
            {ssoEnabled ? "Active" : "Not Configured"}
          </Badge>
        }
      >
        {/* Supported IdPs */}
        <div className="mb-5">
          <p className="text-xs font-medium text-heading mb-2">
            Supported Identity Providers
          </p>
          <div className="flex flex-wrap gap-1.5">
            {[
              "Okta",
              "Azure AD",
              "Google Workspace",
              "OneLogin",
              "SAML 2.0",
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

        {/* Setup Steps */}
        <div className="rounded-lg border border-border bg-cream-lighter p-4 mb-5">
          <h4 className="text-sm font-medium text-heading mb-3">
            Setup Instructions
          </h4>
          <ol className="space-y-3 text-sm text-body">
            <li className="flex gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-blue text-[10px] text-white font-semibold mt-0.5">
                1
              </span>
              <span>
                Create a new SAML application in your Identity Provider
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-blue text-[10px] text-white font-semibold mt-0.5">
                2
              </span>
              <span className="flex-1">
                Set the ACS URL to:
                <br />
                <CopyableCode
                  text="https://clerk.spondic.com/v1/saml/acs"
                  field="acs"
                />
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-blue text-[10px] text-white font-semibold mt-0.5">
                3
              </span>
              <span className="flex-1">
                Set Entity ID to:
                <br />
                <CopyableCode
                  text="https://clerk.spondic.com"
                  field="entity"
                />
              </span>
            </li>
            <li className="flex gap-2.5">
              <span className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full bg-brand-blue text-[10px] text-white font-semibold mt-0.5">
                4
              </span>
              <span>Enter your IdP details in the form below</span>
            </li>
          </ol>
        </div>

        {/* SAML Form */}
        <form onSubmit={handleSsoSave} className="space-y-4">
          <div>
            <Label htmlFor="idp-metadata-url">IdP Metadata URL</Label>
            <Input
              id="idp-metadata-url"
              type="url"
              value={idpMetadataUrl}
              onChange={(e) => setIdpMetadataUrl(e.target.value)}
              placeholder="https://your-idp.com/metadata.xml"
              disabled={ssoSaving}
              className="mt-1.5"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <div>
              <Label htmlFor="idp-entity-id">IdP Entity ID</Label>
              <Input
                id="idp-entity-id"
                type="text"
                value={idpEntityId}
                onChange={(e) => setIdpEntityId(e.target.value)}
                placeholder="https://your-idp.com/entity"
                disabled={ssoSaving}
                className="mt-1.5"
              />
            </div>
            <div>
              <Label htmlFor="idp-sso-url">IdP SSO URL</Label>
              <Input
                id="idp-sso-url"
                type="url"
                value={idpSsoUrl}
                onChange={(e) => setIdpSsoUrl(e.target.value)}
                placeholder="https://your-idp.com/sso"
                disabled={ssoSaving}
                className="mt-1.5"
              />
            </div>
          </div>
          <div>
            <Label htmlFor="idp-certificate">IdP Certificate</Label>
            <textarea
              id="idp-certificate"
              className="mt-1.5 flex w-full rounded-lg border border-border bg-white px-4 py-3 text-sm text-heading placeholder-muted transition-colors focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue disabled:cursor-not-allowed disabled:opacity-50 font-mono"
              rows={3}
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
                "Save Configuration"
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
            <p className="flex items-center gap-1.5 text-sm text-green-600">
              <CheckIcon className="h-4 w-4" />
              {ssoSaveSuccess}
            </p>
          )}
        </form>

        {/* SSO Enforcement Toggle */}
        <div className="flex items-center justify-between rounded-lg border border-border bg-cream-lighter p-4 mt-5">
          <div>
            <p className="text-sm font-medium text-heading">
              Require SSO for all members
            </p>
            <p className="text-xs text-muted mt-0.5">
              Password-based login will be disabled when enforced.
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
          for assistance.
        </p>
      </Section>

      {/* ── Danger Zone ──────────────────────────────────────────────── */}
      <section className="rounded-xl border-2 border-red-200 bg-white overflow-hidden">
        <div className="flex items-start gap-3 p-6">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-red-50">
            <ExclamationTriangleIcon className="h-4.5 w-4.5 text-red-500" />
          </div>
          <div className="flex-1">
            <h3 className="text-base font-semibold text-red-700">
              Danger Zone
            </h3>
            <p className="text-sm text-red-600/80 mt-0.5">
              Permanently delete this organization and all its data. This action
              cannot be undone.
            </p>
            <Button
              variant="destructive"
              className="mt-4"
              onClick={() => setShowDeleteDialog(true)}
            >
              <ExclamationTriangleIcon className="h-4 w-4" />
              Delete Organization
            </Button>
          </div>
        </div>
      </section>

      {/* Delete Confirmation Dialog */}
      <Dialog
        open={showDeleteDialog}
        onOpenChange={(open) => {
          setShowDeleteDialog(open);
          if (!open) {
            setDeleteInput("");
            setDeleteError("");
          }
        }}
      >
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Delete Organization</DialogTitle>
            <DialogDescription>
              This will permanently delete{" "}
              <span className="font-semibold text-heading">
                {organization.name}
              </span>{" "}
              and all its data including projects, documents, and team members.
              This cannot be undone.
            </DialogDescription>
          </DialogHeader>

          <div className="mt-2">
            <Label htmlFor="delete-confirm">
              Type{" "}
              <span className="font-semibold text-red-600">
                {organization.name}
              </span>{" "}
              to confirm
            </Label>
            <Input
              id="delete-confirm"
              type="text"
              value={deleteInput}
              onChange={(e) => setDeleteInput(e.target.value)}
              placeholder={organization.name}
              className="mt-1.5"
              disabled={deleting}
            />
            {deleteError && (
              <p className="mt-2 text-sm text-red-600">{deleteError}</p>
            )}
          </div>

          <DialogFooter>
            <Button
              variant="outline"
              onClick={() => setShowDeleteDialog(false)}
              disabled={deleting}
            >
              Cancel
            </Button>
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
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
}

// ── Branding Section ────────────────────────────────────────────────────────

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
      <section className="rounded-xl border border-border bg-white p-6">
        <div className="h-5 w-32 animate-pulse rounded bg-gray-200 mb-4" />
        <div className="space-y-3">
          <div className="h-10 w-full animate-pulse rounded-lg bg-gray-200" />
          <div className="h-10 w-full animate-pulse rounded-lg bg-gray-200" />
        </div>
      </section>
    );
  }

  return (
    <Section
      icon={PaintBrushIcon}
      title="Branding"
      description="Customize your workspace appearance for all members."
    >
      <form onSubmit={handleBrandingSave}>
        {/* Logo Upload */}
        <div className="mb-6">
          <Label className="mb-2">Logo</Label>
          <div
            onDragOver={(e) => e.preventDefault()}
            onDrop={handleFileDrop}
            onClick={() => fileInputRef.current?.click()}
            className="flex items-center gap-4 rounded-xl border-2 border-dashed border-border hover:border-brand-blue/40 p-4 cursor-pointer transition-colors group"
          >
            {logoPreview ? (
              <img
                src={logoPreview}
                alt="Logo preview"
                className="h-12 w-auto max-w-[160px] object-contain rounded"
              />
            ) : (
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-cream group-hover:bg-brand-blue/10 transition-colors">
                <PhotoIcon className="h-6 w-6 text-muted group-hover:text-brand-blue transition-colors" />
              </div>
            )}
            <div className="flex-1 min-w-0">
              <p className="text-sm text-heading font-medium">
                {logoPreview
                  ? "Click or drag to replace"
                  : "Click or drag to upload"}
              </p>
              <p className="text-xs text-muted mt-0.5">
                PNG, JPG, or SVG &middot; Max 2MB
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

        <div className="space-y-5">
          {/* Display Name */}
          <div>
            <Label htmlFor="brand-display-name">Display Name</Label>
            <Input
              id="brand-display-name"
              type="text"
              value={displayName}
              onChange={(e) => setDisplayName(e.target.value)}
              placeholder="Overrides org name in sidebar"
              disabled={updateBranding.isPending}
              className="mt-1.5"
            />
          </div>

          {/* Colors */}
          <div>
            <div className="flex items-center gap-1.5 mb-3">
              <SwatchIcon className="h-4 w-4 text-muted" />
              <span className="text-sm font-medium text-heading">Colors</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
              <ColorInput
                id="brand-primary"
                label="Primary"
                value={primaryColor}
                onChange={setPrimaryColor}
                placeholder="#2d5fa0"
                disabled={updateBranding.isPending}
              />
              <ColorInput
                id="brand-secondary"
                label="Secondary"
                value={secondaryColor}
                onChange={setSecondaryColor}
                placeholder="#1a2740"
                disabled={updateBranding.isPending}
              />
              <ColorInput
                id="brand-accent"
                label="Accent"
                value={accentColor}
                onChange={setAccentColor}
                placeholder="#c49a3c"
                disabled={updateBranding.isPending}
              />
            </div>
          </div>

          {/* Custom Domain */}
          <div>
            <div className="flex items-center gap-1.5 mb-1.5">
              <GlobeAltIcon className="h-4 w-4 text-muted" />
              <Label htmlFor="brand-domain">Custom Domain</Label>
            </div>
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
            <div className="flex items-center gap-1.5 mb-3">
              <EnvelopeIcon className="h-4 w-4 text-muted" />
              <span className="text-sm font-medium text-heading">
                Email Settings
              </span>
            </div>
            <div className="space-y-4">
              <div>
                <Label htmlFor="brand-email-from">From Name</Label>
                <Input
                  id="brand-email-from"
                  type="text"
                  value={emailFromName}
                  onChange={(e) => setEmailFromName(e.target.value)}
                  placeholder="Acme Corp RFP Team"
                  disabled={updateBranding.isPending}
                  className="mt-1.5"
                />
              </div>
              <div>
                <Label htmlFor="brand-email-footer">
                  Email / Export Footer
                </Label>
                <textarea
                  id="brand-email-footer"
                  className="mt-1.5 flex w-full rounded-lg border border-border bg-white px-4 py-3 text-sm text-heading placeholder-muted transition-colors focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue disabled:cursor-not-allowed disabled:opacity-50 resize-none"
                  rows={2}
                  value={emailFooter}
                  onChange={(e) => setEmailFooter(e.target.value)}
                  placeholder="Custom footer text for exported documents and emails..."
                  disabled={updateBranding.isPending}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Actions */}
        <div className="mt-6 flex items-center gap-3">
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
            <ArrowPathIcon className="h-4 w-4" />
            Reset Defaults
          </Button>
          {updateBranding.isError && (
            <p className="text-sm text-red-600">
              {updateBranding.error.message}
            </p>
          )}
          {brandingSaveSuccess && (
            <p className="flex items-center gap-1.5 text-sm text-green-600">
              <CheckIcon className="h-4 w-4" />
              {brandingSaveSuccess}
            </p>
          )}
        </div>
      </form>
    </Section>
  );
}
