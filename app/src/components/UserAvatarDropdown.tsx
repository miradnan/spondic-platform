import { useUser, useClerk, useOrganization } from "@clerk/react";
import { useNavigate } from "react-router-dom";
import { useTranslation } from "react-i18next";
import {
  Cog6ToothIcon,
  ArrowRightStartOnRectangleIcon,
  ChevronUpDownIcon,
} from "@heroicons/react/24/outline";
import { Popover, PopoverTrigger, PopoverContent } from "./ui/popover.tsx";
import { useState } from "react";

const ROLE_LABELS: Record<string, string> = {
  "org:admin": "Admin",
  "org:member": "Member",
  admin: "Admin",
  member: "Member",
};

const ROLE_STYLES: Record<string, string> = {
  "org:admin": "bg-brand-gold/15 text-brand-gold border-brand-gold/25",
  admin: "bg-brand-gold/15 text-brand-gold border-brand-gold/25",
  "org:member": "bg-brand-blue/10 text-brand-blue border-brand-blue/20",
  member: "bg-brand-blue/10 text-brand-blue border-brand-blue/20",
};

export function UserAvatarDropdown() {
  const { user } = useUser();
  const { signOut } = useClerk();
  const { membership, organization } = useOrganization();
  const navigate = useNavigate();
  const { t } = useTranslation();
  const [open, setOpen] = useState(false);

  if (!user) return null;

  const fullName = [user.firstName, user.lastName].filter(Boolean).join(" ") || "User";
  const email = user.primaryEmailAddress?.emailAddress ?? "";
  const avatarUrl = user.imageUrl;
  const initials = [user.firstName?.[0], user.lastName?.[0]]
    .filter(Boolean)
    .join("")
    .toUpperCase() || "U";
  const role = membership?.role ?? "";
  const roleLabel = ROLE_LABELS[role] ?? role;
  const roleStyle = ROLE_STYLES[role] ?? "bg-surface-inset text-muted border-border";

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="flex items-center gap-2 rounded-lg px-2 py-1.5 hover:bg-cream-light focus:outline-none focus:ring-2 focus:ring-brand-blue focus:ring-offset-1 transition-colors"
          aria-label={t("userMenu.ariaLabel")}
        >
          {avatarUrl ? (
            <img
              src={avatarUrl}
              alt={fullName}
              className="h-8 w-8 rounded-full object-cover ring-2 ring-border"
            />
          ) : (
            <div className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-blue text-white text-xs font-semibold ring-2 ring-brand-blue/30">
              {initials}
            </div>
          )}
          <ChevronUpDownIcon className="h-3.5 w-3.5 text-muted hidden sm:block" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" sideOffset={8} className="w-72 p-0 overflow-hidden">
        {/* User info header */}
        <div className="px-4 pt-4 pb-3">
          <div className="flex items-start gap-3">
            {avatarUrl ? (
              <img
                src={avatarUrl}
                alt={fullName}
                className="h-10 w-10 rounded-full object-cover ring-2 ring-border shrink-0"
              />
            ) : (
              <div className="flex h-10 w-10 items-center justify-center rounded-full bg-brand-blue text-white text-sm font-semibold ring-2 ring-brand-blue/30 shrink-0">
                {initials}
              </div>
            )}
            <div className="min-w-0 flex-1">
              <p className="text-sm font-semibold text-heading truncate">{fullName}</p>
              <p className="text-xs text-muted truncate">{email}</p>
              <div className="flex items-center gap-2 mt-1.5">
                {roleLabel && (
                  <span className={`inline-flex items-center rounded-md border px-1.5 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${roleStyle}`}>
                    {roleLabel}
                  </span>
                )}
                {organization?.name && (
                  <span className="text-[10px] text-muted truncate">
                    {organization.name}
                  </span>
                )}
              </div>
            </div>
          </div>
        </div>

        <div className="border-t border-border" />

        {/* Menu items */}
        <div className="py-1.5 px-1.5">
          <button
            onClick={() => {
              setOpen(false);
              navigate("/settings");
            }}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-body hover:bg-cream-light transition-colors group"
          >
            <Cog6ToothIcon className="h-4 w-4 text-muted group-hover:text-body transition-colors" />
            <span className="flex-1 text-left">{t("nav.settings")}</span>
          </button>
        </div>
        <div className="border-t border-border" />
        <div className="py-1.5 px-1.5">
          <button
            onClick={() => signOut({ redirectUrl: "/sign-in" })}
            className="flex w-full items-center gap-3 rounded-lg px-3 py-2 text-sm text-red-600 hover:bg-red-50 dark:hover:bg-red-950/20 transition-colors group"
          >
            <ArrowRightStartOnRectangleIcon className="h-4 w-4" />
            <span className="flex-1 text-left">{t("userMenu.signOut")}</span>
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}
