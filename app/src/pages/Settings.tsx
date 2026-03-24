import { useState, useRef } from "react";
import { useTranslation } from "react-i18next";
import {
  Cog6ToothIcon,
  BellIcon,
  ComputerDesktopIcon,
  CommandLineIcon,
  UserCircleIcon,
  KeyIcon,
  ShieldCheckIcon,
  CameraIcon,
  ClipboardDocumentIcon,
  LockClosedIcon,
} from "@heroicons/react/24/outline";
import { useUser as useClerkUser, useReverification, useAuth } from "@clerk/react";
import {
  useNotificationPreferences,
  useUpdateNotificationPreference,
  useUserProfile,
  useUpdateUserProfile,
  useUpdateUserPassword,
  useUploadUserAvatar,
  useDeleteUserAvatar,
  useUser2FAStatus,
  useDisableUserMFA,
} from "../hooks/useApi.ts";
import { useToast } from "../components/Toast.tsx";
import { getPlanLimits } from "../lib/planLimits.ts";
import type { NotificationType } from "../lib/types.ts";

const NOTIFICATION_TYPES: { type: NotificationType; labelKey: string; descriptionKey: string }[] = [
  { type: "answer_approved", labelKey: "settings.notifType.answerApproved", descriptionKey: "settings.notifDesc.answerApproved" },
  { type: "comment_added", labelKey: "settings.notifType.newComment", descriptionKey: "settings.notifDesc.newComment" },
  { type: "document_indexed", labelKey: "settings.notifType.documentIndexed", descriptionKey: "settings.notifDesc.documentIndexed" },
  { type: "rfp_parsed", labelKey: "settings.notifType.rfpParsed", descriptionKey: "settings.notifDesc.rfpParsed" },
  { type: "rfp_drafted", labelKey: "settings.notifType.answersDrafted", descriptionKey: "settings.notifDesc.answersDrafted" },
  { type: "deadline_approaching", labelKey: "settings.notifType.deadlineApproaching", descriptionKey: "settings.notifDesc.deadlineApproaching" },
  { type: "team_assignment", labelKey: "settings.notifType.teamAssignment", descriptionKey: "settings.notifDesc.teamAssignment" },
  { type: "question_assigned", labelKey: "settings.notifType.questionAssigned", descriptionKey: "settings.notifDesc.questionAssigned" },
];

const SHORTCUTS: { keys: string[]; descriptionKey: string }[] = [
  { keys: ["J", "/", "K"], descriptionKey: "settings.shortcut.navigateQuestions" },
  { keys: ["A"], descriptionKey: "settings.shortcut.approveAnswer" },
  { keys: ["E"], descriptionKey: "settings.shortcut.editAnswer" },
  { keys: ["R"], descriptionKey: "settings.shortcut.rejectAnswer" },
  { keys: ["\u2318", "S"], descriptionKey: "settings.shortcut.saveEdits" },
  { keys: ["\u2318", "K"], descriptionKey: "settings.shortcut.commandPalette" },
];

function Toggle({ enabled, onChange }: { enabled: boolean; onChange: (val: boolean) => void }) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={enabled}
      onClick={() => onChange(!enabled)}
      className={`relative inline-flex h-6 w-11 shrink-0 cursor-pointer rounded-full border-2 border-transparent transition-colors duration-200 ease-in-out focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-2 ${
        enabled ? "bg-brand-blue" : "bg-surface-inset"
      }`}
    >
      <span
        className={`pointer-events-none inline-block h-5 w-5 rounded-full bg-white shadow ring-0 transition-transform duration-200 ease-in-out ${
          enabled ? "translate-x-5" : "translate-x-0"
        }`}
      />
    </button>
  );
}

function SkeletonRow() {
  return (
    <div className="flex items-center justify-between py-4 border-b border-border animate-pulse">
      <div className="space-y-2">
        <div className="h-4 w-32 bg-surface-inset rounded" />
        <div className="h-3 w-56 bg-surface-inset rounded" />
      </div>
      <div className="flex items-center gap-8">
        <div className="h-6 w-11 bg-surface-inset rounded-full" />
        <div className="h-6 w-11 bg-surface-inset rounded-full" />
      </div>
    </div>
  );
}

function Kbd({ children }: { children: React.ReactNode }) {
  return (
    <kbd className="inline-flex h-6 min-w-[24px] items-center justify-center rounded-md border border-border bg-surface-inset px-1.5 text-xs font-medium text-heading shadow-sm">
      {children}
    </kbd>
  );
}

/* ── Account Section ────────────────────────────────────────────────────── */

function AccountSection() {
  const { t } = useTranslation();
  const { data: profile, isLoading } = useUserProfile();
  const updateProfile = useUpdateUserProfile();
  const uploadAvatar = useUploadUserAvatar();
  const deleteAvatar = useDeleteUserAvatar();
  const { toast } = useToast();

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [initialized, setInitialized] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  // Initialize form fields when profile loads
  if (profile && !initialized) {
    setFirstName(profile.first_name);
    setLastName(profile.last_name);
    setInitialized(true);
  }

  function handleSaveProfile(e: React.FormEvent) {
    e.preventDefault();
    updateProfile.mutate(
      { first_name: firstName, last_name: lastName },
      {
        onSuccess: () => toast("success", "Profile updated"),
        onError: (err) => toast("error", err.message),
      },
    );
  }

  function handleAvatarChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;

    // Show instant local preview
    const objectUrl = URL.createObjectURL(file);
    setPreviewUrl(objectUrl);

    const formData = new FormData();
    formData.append("file", file);
    uploadAvatar.mutate(formData, {
      onSuccess: () => {
        toast("success", "Avatar updated");
        setPreviewUrl(null);
        URL.revokeObjectURL(objectUrl);
      },
      onError: (err) => {
        toast("error", err.message);
        setPreviewUrl(null);
        URL.revokeObjectURL(objectUrl);
      },
    });
    // Reset input so the same file can be re-selected
    e.target.value = "";
  }

  function handleDeleteAvatar() {
    deleteAvatar.mutate(undefined, {
      onSuccess: () => {
        toast("success", "Avatar removed");
        setPreviewUrl(null);
      },
      onError: (err) => toast("error", err.message),
    });
  }

  const isAvatarBusy = uploadAvatar.isPending || deleteAvatar.isPending;
  const displayUrl = previewUrl ?? profile?.image_url;

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 animate-pulse">
        <div className="h-5 w-40 bg-surface-inset rounded mb-4" />
        <div className="flex items-center gap-4 mb-6">
          <div className="h-16 w-16 rounded-full bg-surface-inset" />
          <div className="space-y-2">
            <div className="h-4 w-32 bg-surface-inset rounded" />
            <div className="h-3 w-48 bg-surface-inset rounded" />
          </div>
        </div>
      </div>
    );
  }

  const initials = [profile?.first_name?.[0], profile?.last_name?.[0]]
    .filter(Boolean)
    .join("")
    .toUpperCase() || "U";

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="flex items-center gap-2 mb-1">
        <UserCircleIcon className="h-5 w-5 text-brand-blue" />
        <h2 className="text-base font-semibold text-heading">{t("settings.account")}</h2>
      </div>
      <p className="text-sm text-muted mb-6">{t("settings.accountDesc")}</p>

      {/* Avatar */}
      <div className="flex items-center gap-4 mb-6">
        <div className="relative group">
          {displayUrl ? (
            <img
              src={displayUrl}
              alt="Avatar"
              className={`h-16 w-16 rounded-full object-cover transition-opacity ${isAvatarBusy ? "opacity-40" : ""}`}
            />
          ) : (
            <div className={`flex h-16 w-16 items-center justify-center rounded-full bg-brand-blue text-white text-lg font-semibold transition-opacity ${isAvatarBusy ? "opacity-40" : ""}`}>
              {initials}
            </div>
          )}
          {/* Spinner overlay while uploading/deleting */}
          {isAvatarBusy && (
            <div className="absolute inset-0 flex items-center justify-center rounded-full">
              <svg className="h-6 w-6 animate-spin text-brand-blue" viewBox="0 0 24 24" fill="none">
                <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="3" />
                <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
              </svg>
            </div>
          )}
          {/* Hover overlay — hidden while busy */}
          {!isAvatarBusy && (
            <button
              onClick={() => fileInputRef.current?.click()}
              className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40 opacity-0 group-hover:opacity-100 transition-opacity"
              aria-label={t("settings.changeAvatar")}
            >
              <CameraIcon className="h-5 w-5 text-white" />
            </button>
          )}
          <input
            ref={fileInputRef}
            type="file"
            accept="image/*"
            className="hidden"
            onChange={handleAvatarChange}
          />
        </div>
        <div>
          <p className="text-sm font-medium text-heading">
            {profile?.first_name} {profile?.last_name}
          </p>
          <p className="text-xs text-muted">{profile?.email}</p>
          <div className="flex items-center gap-2 mt-1">
            <button
              onClick={() => fileInputRef.current?.click()}
              disabled={isAvatarBusy}
              className="text-xs text-brand-blue hover:underline disabled:opacity-50"
            >
              {uploadAvatar.isPending ? t("settings.uploading") : t("settings.changePhoto")}
            </button>
            {profile?.image_url && (
              <>
                <span className="text-xs text-muted">|</span>
                <button
                  onClick={handleDeleteAvatar}
                  disabled={isAvatarBusy}
                  className="text-xs text-red-600 hover:underline disabled:opacity-50"
                >
                  {deleteAvatar.isPending ? t("settings.removingPhoto") : t("settings.removePhoto")}
                </button>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Name fields */}
      <form onSubmit={handleSaveProfile} className="space-y-4">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div>
            <label className="block text-sm font-medium text-heading mb-1">{t("settings.firstName")}</label>
            <input
              type="text"
              value={firstName}
              onChange={(e) => setFirstName(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-1"
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-heading mb-1">{t("settings.lastName")}</label>
            <input
              type="text"
              value={lastName}
              onChange={(e) => setLastName(e.target.value)}
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-1"
            />
          </div>
        </div>
        <div>
          <label className="block text-sm font-medium text-heading mb-1">{t("common.email")}</label>
          <input
            type="email"
            value={profile?.email ?? ""}
            disabled
            className="w-full rounded-lg border border-border bg-surface-inset px-3 py-2 text-sm text-muted cursor-not-allowed"
          />
          <p className="text-xs text-muted mt-1">{t("settings.emailNote")}</p>
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={updateProfile.isPending}
            className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue/90 transition-colors disabled:opacity-50"
          >
            {updateProfile.isPending ? t("settings.saving") : t("settings.saveChanges")}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ── Password Section ───────────────────────────────────────────────────── */

function PasswordSection() {
  const { t } = useTranslation();
  const { data: profile } = useUserProfile();
  const updatePassword = useUpdateUserPassword();
  const { toast } = useToast();

  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [touched, setTouched] = useState<Record<string, boolean>>({});

  const passwordTooShort = touched.newPassword && newPassword.length > 0 && newPassword.length < 8;
  const passwordsDoNotMatch = touched.confirmPassword && confirmPassword.length > 0 && newPassword !== confirmPassword;

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setTouched({ newPassword: true, confirmPassword: true });
    if (newPassword !== confirmPassword) {
      toast("error", "New passwords do not match");
      return;
    }
    if (newPassword.length < 8) {
      toast("error", "Password must be at least 8 characters");
      return;
    }

    updatePassword.mutate(
      { current_password: currentPassword, new_password: newPassword },
      {
        onSuccess: () => {
          toast("success", "Password updated successfully");
          setCurrentPassword("");
          setNewPassword("");
          setConfirmPassword("");
        },
        onError: (err) => toast("error", err.message),
      },
    );
  }

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="flex items-center gap-2 mb-1">
        <KeyIcon className="h-5 w-5 text-brand-blue" />
        <h2 className="text-base font-semibold text-heading">{t("settings.password")}</h2>
      </div>
      <p className="text-sm text-muted mb-6">
        {profile?.has_password
          ? t("settings.passwordDesc")
          : t("settings.setPasswordDesc")}
      </p>

      <form onSubmit={handleSubmit} className="space-y-4 max-w-md">
        {profile?.has_password && (
          <div>
            <label className="block text-sm font-medium text-heading mb-1">{t("settings.currentPassword")}</label>
            <input
              type="password"
              value={currentPassword}
              onChange={(e) => setCurrentPassword(e.target.value)}
              required
              className="w-full rounded-lg border border-border bg-surface px-3 py-2 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-1"
            />
          </div>
        )}
        <div>
          <label className="block text-sm font-medium text-heading mb-1">{t("settings.newPassword")}</label>
          <input
            type="password"
            value={newPassword}
            onChange={(e) => setNewPassword(e.target.value)}
            onBlur={() => setTouched((prev) => ({ ...prev, newPassword: true }))}
            required
            minLength={8}
            className={`w-full rounded-lg border bg-surface px-3 py-2 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-offset-1 ${
              passwordTooShort
                ? "border-red-400 focus:ring-red-500"
                : "border-border focus:ring-brand-blue"
            }`}
          />
          {passwordTooShort && (
            <p className="mt-1 text-xs text-red-600">Password must be at least 8 characters.</p>
          )}
        </div>
        <div>
          <label className="block text-sm font-medium text-heading mb-1">{t("settings.confirmPassword")}</label>
          <input
            type="password"
            value={confirmPassword}
            onChange={(e) => setConfirmPassword(e.target.value)}
            onBlur={() => setTouched((prev) => ({ ...prev, confirmPassword: true }))}
            required
            minLength={8}
            className={`w-full rounded-lg border bg-surface px-3 py-2 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-offset-1 ${
              passwordsDoNotMatch
                ? "border-red-400 focus:ring-red-500"
                : "border-border focus:ring-brand-blue"
            }`}
          />
          {passwordsDoNotMatch && (
            <p className="mt-1 text-xs text-red-600">Passwords do not match.</p>
          )}
        </div>
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={updatePassword.isPending}
            className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue/90 transition-colors disabled:opacity-50"
          >
            {updatePassword.isPending ? t("settings.updatingPassword") : profile?.has_password ? t("settings.updatePassword") : t("settings.setPassword")}
          </button>
        </div>
      </form>
    </div>
  );
}

/* ── Two-Factor Authentication Section ──────────────────────────────────── */

function TwoFactorSection() {
  const { t } = useTranslation();
  const { sessionClaims } = useAuth();
  const planClaim = (sessionClaims as Record<string, unknown>)?.pla as string | undefined;
  const currentPlan = planClaim?.replace("o:", "") || "free_org";
  const { twoFactorEnabled: has2FA } = getPlanLimits(currentPlan);

  if (!has2FA) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6">
        <div className="flex items-center gap-2 mb-1">
          <ShieldCheckIcon className="h-5 w-5 text-brand-blue" />
          <h2 className="text-base font-semibold text-heading">{t("settings.twoFactor")}</h2>
          <span className="ml-auto rounded-md border border-border bg-surface-inset px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-muted">
            {t("settings.growthPlus")}
          </span>
        </div>
        <p className="text-sm text-muted mb-6">
          {t("settings.twoFactorDesc")}
        </p>
        <div className="flex items-start gap-3 rounded-lg border border-border bg-cream-lighter p-4">
          <LockClosedIcon className="h-5 w-5 text-muted mt-0.5 shrink-0" />
          <div>
            <p className="text-sm font-medium text-heading">
              {t("settings.twoFactorLocked")}
            </p>
            <p className="text-xs text-muted mt-1">
              {t("settings.twoFactorLockedDesc")}
            </p>
            <a
              href="/admin/billing#change-plan"
              className="inline-flex items-center gap-1 mt-3 text-sm font-medium text-brand-blue hover:text-brand-blue/80 transition-colors"
            >
              {t("settings.upgradePlan")}
            </a>
          </div>
        </div>
      </div>
    );
  }

  return <TwoFactorEnabled />;
}

function TwoFactorEnabled() {
  const { t } = useTranslation();
  const { data: status, isLoading } = useUser2FAStatus();
  const disableMFA = useDisableUserMFA();
  const { user } = useClerkUser();
  const { toast } = useToast();

  const [setupStep, setSetupStep] = useState<"idle" | "qr" | "verify" | "done">("idle");
  const [totpData, setTotpData] = useState<{ secret: string; uri: string } | null>(null);
  const [verifyCode, setVerifyCode] = useState("");
  const [backupCodes, setBackupCodes] = useState<string[]>([]);
  const [enabling, setEnabling] = useState(false);
  const [verifying, setVerifying] = useState(false);

  const createTOTPWithReverification = useReverification(async () => {
    if (!user) throw new Error("Not signed in");
    return user.createTOTP();
  });

  const verifyTOTPWithReverification = useReverification(async (code: string) => {
    if (!user) throw new Error("Not signed in");
    return user.verifyTOTP({ code });
  });

  async function handleEnable() {
    setEnabling(true);
    try {
      const totp = await createTOTPWithReverification();
      if (!totp) return;
      setTotpData({ secret: totp.secret ?? "", uri: totp.uri ?? "" });
      if (totp.backupCodes?.length) setBackupCodes(totp.backupCodes);
      setSetupStep("qr");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Failed to create TOTP");
    } finally {
      setEnabling(false);
    }
  }

  async function handleVerify(e: React.FormEvent) {
    e.preventDefault();
    setVerifying(true);
    try {
      const result = await verifyTOTPWithReverification(verifyCode);
      if (!result) return;
      if (result.backupCodes?.length) setBackupCodes(result.backupCodes);
      setSetupStep("done");
      toast("success", "Two-factor authentication enabled");
    } catch (err) {
      toast("error", err instanceof Error ? err.message : "Invalid verification code");
    } finally {
      setVerifying(false);
    }
  }

  function handleDisable() {
    disableMFA.mutate(undefined, {
      onSuccess: () => {
        setSetupStep("idle");
        setTotpData(null);
        setVerifyCode("");
        setBackupCodes([]);
        toast("success", "Two-factor authentication disabled");
      },
      onError: (err) => toast("error", err.message),
    });
  }

  function copyToClipboard(text: string) {
    navigator.clipboard.writeText(text);
    toast("success", "Copied to clipboard");
  }

  if (isLoading) {
    return (
      <div className="rounded-xl border border-border bg-surface p-6 animate-pulse">
        <div className="h-5 w-56 bg-surface-inset rounded mb-4" />
        <div className="h-4 w-72 bg-surface-inset rounded" />
      </div>
    );
  }

  const isEnabled = status?.totp_enabled;

  return (
    <div className="rounded-xl border border-border bg-surface p-6">
      <div className="flex items-center gap-2 mb-1">
        <ShieldCheckIcon className="h-5 w-5 text-brand-blue" />
        <h2 className="text-base font-semibold text-heading">{t("settings.twoFactor")}</h2>
      </div>
      <p className="text-sm text-muted mb-6">
        {t("settings.twoFactorDesc")}
      </p>

      {setupStep === "idle" && (
        <div className="flex items-center justify-between py-3">
          <div className="flex items-center gap-3">
            <div className={`h-2.5 w-2.5 rounded-full ${isEnabled ? "bg-green-500" : "bg-surface-inset"}`} />
            <span className="text-sm font-medium text-heading">
              {isEnabled ? t("common.enabled") : t("common.disabled")}
            </span>
          </div>
          {isEnabled ? (
            <button
              onClick={handleDisable}
              disabled={disableMFA.isPending}
              className="rounded-lg border border-red-200 px-4 py-2 text-sm font-medium text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors disabled:opacity-50"
            >
              {disableMFA.isPending ? t("settings.disabling2fa") : t("settings.disable2fa")}
            </button>
          ) : (
            <button
              onClick={handleEnable}
              disabled={enabling}
              className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue/90 transition-colors disabled:opacity-50"
            >
              {enabling ? t("settings.settingUp2fa") : t("settings.enable2fa")}
            </button>
          )}
        </div>
      )}

      {setupStep === "qr" && totpData && (
        <div className="space-y-4">
          <div className="rounded-lg border border-border bg-cream-lighter p-4">
            <p className="text-sm font-medium text-heading mb-3">
              {t("settings.scanQr")}
            </p>
            <div className="flex justify-center mb-3">
              <img
                src={`https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=${encodeURIComponent(totpData.uri)}`}
                alt="TOTP QR Code"
                className="h-48 w-48 rounded-lg"
              />
            </div>
            <p className="text-xs text-muted text-center mb-2">{t("settings.enterSecretManually")}</p>
            <div className="flex items-center justify-center gap-2">
              <code className="rounded bg-surface-inset px-2 py-1 text-xs font-mono text-heading">
                {totpData.secret}
              </code>
              <button
                onClick={() => copyToClipboard(totpData.secret)}
                className="rounded p-1 hover:bg-surface-inset transition-colors"
                aria-label="Copy secret"
              >
                <ClipboardDocumentIcon className="h-4 w-4 text-muted" />
              </button>
            </div>
          </div>

          <form onSubmit={handleVerify} className="space-y-3">
            <div>
              <label className="block text-sm font-medium text-heading mb-1">
                {t("settings.enterCode")}
              </label>
              <input
                type="text"
                value={verifyCode}
                onChange={(e) => setVerifyCode(e.target.value.replace(/\D/g, "").slice(0, 6))}
                placeholder="000000"
                maxLength={6}
                autoFocus
                className="w-full max-w-[200px] rounded-lg border border-border bg-surface px-3 py-2 text-sm text-heading font-mono tracking-widest text-center focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-1"
              />
            </div>
            <div className="flex items-center gap-3">
              <button
                type="submit"
                disabled={verifyCode.length !== 6 || verifying}
                className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue/90 transition-colors disabled:opacity-50"
              >
                {verifying ? t("settings.verifying") : t("settings.verifyEnable")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setSetupStep("idle");
                  setTotpData(null);
                  setVerifyCode("");
                }}
                className="rounded-lg border border-border px-4 py-2 text-sm font-medium text-body hover:bg-cream-light transition-colors"
              >
                {t("common.cancel")}
              </button>
            </div>
          </form>
        </div>
      )}

      {setupStep === "done" && backupCodes.length > 0 && (
        <div className="space-y-4">
          <div className="rounded-lg border border-amber-200 bg-amber-50 dark:bg-amber-950/20 dark:border-amber-800 p-4">
            <p className="text-sm font-medium text-amber-800 dark:text-amber-200 mb-2">
              {t("settings.saveBackupCodes")}
            </p>
            <p className="text-xs text-amber-700 dark:text-amber-300 mb-3">
              {t("settings.backupCodesDesc")}
            </p>
            <div className="grid grid-cols-2 gap-2 mb-3">
              {backupCodes.map((code) => (
                <code
                  key={code}
                  className="rounded bg-white dark:bg-amber-950/40 px-2 py-1.5 text-xs font-mono text-heading text-center border border-amber-200 dark:border-amber-800"
                >
                  {code}
                </code>
              ))}
            </div>
            <button
              onClick={() => copyToClipboard(backupCodes.join("\n"))}
              className="flex items-center gap-1.5 text-xs text-amber-700 dark:text-amber-300 hover:underline"
            >
              <ClipboardDocumentIcon className="h-3.5 w-3.5" />
              {t("settings.copyAllCodes")}
            </button>
          </div>
          <button
            onClick={() => {
              setSetupStep("idle");
              setBackupCodes([]);
            }}
            className="rounded-lg bg-brand-blue px-4 py-2 text-sm font-medium text-white hover:bg-brand-blue/90 transition-colors"
          >
            {t("settings.done")}
          </button>
        </div>
      )}
    </div>
  );
}

/* ── Main Settings Page ─────────────────────────────────────────────────── */

export function Settings() {
  const { t } = useTranslation();
  const { data: preferences, isLoading } = useNotificationPreferences();
  const updatePref = useUpdateNotificationPreference();
  const { toast } = useToast();

  // Display preferences from localStorage
  const [compactMode, setCompactMode] = useState(() => {
    return localStorage.getItem("spondic_compact_mode") === "true";
  });
  const [defaultView, setDefaultView] = useState<"cards" | "table">(() => {
    const stored = localStorage.getItem("spondic_default_view");
    if (stored === "table") return "table";
    return "cards";
  });

  function getPref(type: NotificationType) {
    const found = preferences?.find((p) => p.type === type);
    return {
      in_app_enabled: found?.in_app_enabled ?? true,
      email_enabled: found?.email_enabled ?? false,
    };
  }

  function handleToggle(type: NotificationType, field: "in_app_enabled" | "email_enabled", value: boolean) {
    const current = getPref(type);
    updatePref.mutate({
      type,
      in_app_enabled: field === "in_app_enabled" ? value : current.in_app_enabled,
      email_enabled: field === "email_enabled" ? value : current.email_enabled,
    });

    const label = NOTIFICATION_TYPES.find((n) => n.type === type)?.labelKey;
    const labelText = label ? t(label) : type;
    const channel = field === "email_enabled" ? "Email" : "In-app";
    toast("success", `${channel} notifications for ${labelText} turned ${value ? "on" : "off"}`);
  }

  function handleCompactModeChange(val: boolean) {
    setCompactMode(val);
    localStorage.setItem("spondic_compact_mode", String(val));
    toast("success", "Preference saved");
  }

  function handleDefaultViewChange(val: "cards" | "table") {
    setDefaultView(val);
    localStorage.setItem("spondic_default_view", val);
    toast("success", "Preference saved");
  }

  return (
    <div className="space-y-6 max-w-7xl mx-auto w-full p-4 lg:p-6">
      {/* Page Header */}
      <div className="flex items-center gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-brand-blue/10">
          <Cog6ToothIcon className="h-5 w-5 text-brand-blue" />
        </div>
        <div>
          <h1 className="text-xl font-semibold text-heading">{t("nav.settings")}</h1>
          <p className="text-sm text-muted">{t("settings.subtitle")}</p>
        </div>
      </div>

      {/* Account Section */}
      <AccountSection />

      {/* Password Section */}
      <PasswordSection />

      {/* Two-Factor Authentication Section */}
      <TwoFactorSection />

      {/* Display Preferences Section */}
      <div className="rounded-xl border border-border bg-surface p-6">
        <div className="flex items-center gap-2 mb-1">
          <ComputerDesktopIcon className="h-5 w-5 text-brand-blue" />
          <h2 className="text-base font-semibold text-heading">{t("settings.displayPreferences")}</h2>
        </div>
        <p className="text-sm text-muted mb-6">{t("settings.displayPreferencesDesc")}</p>

        <div className="space-y-4">
          {/* Compact Mode */}
          <div className="flex items-center justify-between py-3 border-b border-border">
            <div>
              <p className="text-sm font-medium text-heading">{t("settings.compactMode")}</p>
              <p className="text-xs text-muted mt-0.5">{t("settings.compactModeDesc")}</p>
            </div>
            <Toggle enabled={compactMode} onChange={handleCompactModeChange} />
          </div>

          {/* Default View */}
          <div className="flex items-center justify-between py-3">
            <div>
              <p className="text-sm font-medium text-heading">{t("settings.defaultView")}</p>
              <p className="text-xs text-muted mt-0.5">{t("settings.defaultViewDesc")}</p>
            </div>
            <select
              value={defaultView}
              onChange={(e) => handleDefaultViewChange(e.target.value as "cards" | "table")}
              className="rounded-lg border border-border bg-surface px-3 py-1.5 text-sm text-heading focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-1"
            >
              <option value="cards">{t("settings.cardView")}</option>
              <option value="table">{t("settings.tableView")}</option>
            </select>
          </div>
        </div>
      </div>

      {/* Notification Preferences Section */}
      <div className="rounded-xl border border-border bg-surface p-6">
        <div className="flex items-center gap-2 mb-1">
          <BellIcon className="h-5 w-5 text-brand-blue" />
          <h2 className="text-base font-semibold text-heading">{t("settings.notificationPreferences")}</h2>
        </div>
        <p className="text-sm text-muted mb-6">{t("settings.notificationPreferencesDesc")}</p>

        {/* Column Headers */}
        <div className="flex items-center justify-between pb-3 border-b border-border">
          <span className="text-xs font-medium text-muted uppercase tracking-wider">{t("settings.event")}</span>
          <div className="flex items-center gap-8">
            <span className="text-xs font-medium text-muted uppercase tracking-wider w-11 text-center">{t("settings.inApp")}</span>
            <span className="text-xs font-medium text-muted uppercase tracking-wider w-11 text-center">{t("common.email")}</span>
          </div>
        </div>

        {isLoading ? (
          <div>
            {Array.from({ length: 4 }).map((_, i) => (
              <SkeletonRow key={i} />
            ))}
          </div>
        ) : (
          <div>
            {NOTIFICATION_TYPES.map((item) => {
              const pref = getPref(item.type);
              return (
                <div
                  key={item.type}
                  className="flex items-center justify-between py-4 border-b border-border last:border-b-0"
                >
                  <div>
                    <p className="text-sm font-medium text-heading">{t(item.labelKey)}</p>
                    <p className="text-xs text-muted mt-0.5">{t(item.descriptionKey)}</p>
                  </div>
                  <div className="flex items-center gap-8">
                    <Toggle
                      enabled={pref.in_app_enabled}
                      onChange={(val) => handleToggle(item.type, "in_app_enabled", val)}
                    />
                    <Toggle
                      enabled={pref.email_enabled}
                      onChange={(val) => handleToggle(item.type, "email_enabled", val)}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>

      {/* Keyboard Shortcuts Section */}
      <div className="rounded-xl border border-border bg-surface p-6">
        <div className="flex items-center gap-2 mb-1">
          <CommandLineIcon className="h-5 w-5 text-brand-blue" />
          <h2 className="text-base font-semibold text-heading">{t("settings.keyboardShortcuts")}</h2>
        </div>
        <p className="text-sm text-muted mb-6">{t("settings.keyboardShortcutsDesc")}</p>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-8 gap-y-3">
          {SHORTCUTS.map((shortcut) => (
            <div
              key={shortcut.descriptionKey}
              className="flex items-center justify-between py-2 border-b border-border/50 last:border-b-0"
            >
              <span className="text-sm text-heading">{t(shortcut.descriptionKey)}</span>
              <div className="flex items-center gap-1">
                {shortcut.keys.map((key, i) =>
                  key === "/" ? (
                    <span key={i} className="text-xs text-muted mx-0.5">/</span>
                  ) : (
                    <Kbd key={i}>{key}</Kbd>
                  )
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}
