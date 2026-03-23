import { useState } from "react";
import {
  UserButton,
  useOrganization,
  useAuth,
} from "@clerk/react";
import { Outlet, Link, useLocation, useParams, useNavigate } from "react-router-dom";
import {
  Squares2X2Icon,
  BookOpenIcon,
  DocumentPlusIcon,
  ChartBarIcon,
  ChatBubbleLeftEllipsisIcon,
  BuildingOffice2Icon,
  UsersIcon,
  CreditCardIcon,
  UserGroupIcon,
  ClipboardDocumentListIcon,
  Cog6ToothIcon,
  Bars3Icon,
  XMarkIcon,
  ChevronRightIcon,
  ChevronDownIcon,
  BellIcon,
  LinkIcon,
  GlobeAltIcon,
} from "@heroicons/react/24/outline";
import { Popover, PopoverTrigger, PopoverContent } from "./ui/popover.tsx";
import { useProject, useUnreadCount, useNotifications, useMarkNotificationRead, useMarkAllRead } from "../hooks/useApi.ts";
import { useAppEvents } from "../hooks/useAppEvents.ts";
import { useBrandingContext } from "../contexts/BrandingContext.tsx";
import { useTranslation } from "react-i18next";

const navLink =
  "flex items-center gap-3 rounded-lg px-3 py-2 text-sm text-white/70 hover:bg-navy-light hover:text-white transition-colors";
const navLinkActive = "bg-navy-light text-white";

function useBreadcrumbs() {
  const location = useLocation();
  const { id } = useParams();
  const { t } = useTranslation();
  const { data: project } = useProject(
    location.pathname.startsWith("/rfp/") && id && id !== "new" ? id : undefined
  );

  const crumbs: { label: string; to?: string }[] = [];
  const path = location.pathname;

  if (path === "/" || path === "/dashboard") {
    crumbs.push({ label: t("breadcrumbs.dashboard") });
  } else if (path === "/rfp/new") {
    crumbs.push({ label: t("breadcrumbs.dashboard"), to: "/dashboard" });
    crumbs.push({ label: t("breadcrumbs.newRfp") });
  } else if (path.startsWith("/rfp/")) {
    crumbs.push({ label: t("breadcrumbs.dashboard"), to: "/dashboard" });
    crumbs.push({ label: project?.name ?? t("breadcrumbs.rfpProject") });
  } else if (path === "/knowledge-base") {
    crumbs.push({ label: t("breadcrumbs.knowledgeBase") });
  } else if (path === "/analytics") {
    crumbs.push({ label: t("breadcrumbs.analytics") });
  } else if (path.startsWith("/chat")) {
    crumbs.push({ label: t("breadcrumbs.aiChat") });
  } else if (path.startsWith("/admin")) {
    crumbs.push({ label: t("breadcrumbs.organization"), to: "/admin/members" });
    if (path.includes("/members")) crumbs.push({ label: t("breadcrumbs.members") });
    else if (path.includes("/organization")) crumbs.push({ label: t("breadcrumbs.settings") });
    else if (path.includes("/billing")) crumbs.push({ label: t("breadcrumbs.billing") });
    else if (path.includes("/teams")) crumbs.push({ label: t("breadcrumbs.teams") });
    else if (path.includes("/audit")) crumbs.push({ label: t("breadcrumbs.auditLog") });
  }

  return crumbs;
}

function Breadcrumbs() {
  const crumbs = useBreadcrumbs();

  return (
    <nav className="flex items-center gap-1.5 text-sm" aria-label="Breadcrumb">
      {crumbs.map((crumb, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && (
            <ChevronRightIcon className="h-3.5 w-3.5 text-muted shrink-0" />
          )}
          {crumb.to && i < crumbs.length - 1 ? (
            <Link
              to={crumb.to}
              className="text-muted hover:text-brand-blue transition-colors"
            >
              {crumb.label}
            </Link>
          ) : (
            <span className="font-medium text-heading truncate max-w-[200px]">
              {crumb.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}

function relativeTime(dateStr: string): string {
  const now = Date.now();
  const diff = now - new Date(dateStr).getTime();
  const mins = Math.floor(diff / 60000);
  if (mins < 1) return "just now";
  if (mins < 60) return `${mins}m ago`;
  const hrs = Math.floor(mins / 60);
  if (hrs < 24) return `${hrs}h ago`;
  const days = Math.floor(hrs / 24);
  return `${days}d ago`;
}

function NotificationBell() {
  const { t } = useTranslation();
  const navigate = useNavigate();
  const [open, setOpen] = useState(false);
  const { data: unreadData } = useUnreadCount();
  const { data: notifData } = useNotifications({ limit: 8 });
  const markRead = useMarkNotificationRead();
  const markAllRead = useMarkAllRead();

  const unreadCount = unreadData?.count ?? 0;
  const notifications = notifData?.data ?? [];

  function handleClick(n: { id: string; is_read: boolean; entity_type?: string; entity_id?: string }) {
    if (!n.is_read) markRead.mutate(n.id);
    setOpen(false);
    if (n.entity_type === "project" && n.entity_id) {
      navigate(`/rfp/${n.entity_id}`);
    } else if (n.entity_type === "document") {
      navigate("/knowledge-base");
    }
  }

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <PopoverTrigger asChild>
        <button
          className="relative rounded-lg p-1.5 text-muted hover:text-body hover:bg-cream-light transition-colors"
          aria-label={t("notifications.title")}
        >
          <BellIcon className="h-5 w-5" />
          {unreadCount > 0 && (
            <span className="absolute top-1 right-1 h-2 w-2 rounded-full bg-brand-blue ring-2 ring-cream" />
          )}
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-80 p-0">
        <div className="flex items-center justify-between px-4 py-3 border-b border-border">
          <h3 className="text-sm font-semibold text-heading">{t("notifications.title")}</h3>
          <div className="flex items-center gap-2">
            <span className="rounded-full bg-brand-blue/10 px-2 py-0.5 text-xs font-medium text-brand-blue">
              {unreadCount}
            </span>
            {unreadCount > 0 && (
              <button
                onClick={() => markAllRead.mutate()}
                className="text-xs text-brand-blue hover:underline"
              >
                Mark all read
              </button>
            )}
          </div>
        </div>
        {notifications.length === 0 ? (
          <div className="px-4 py-8 text-center">
            <BellIcon className="mx-auto h-8 w-8 text-muted/40" />
            <p className="mt-2 text-sm text-muted">{t("notifications.empty")}</p>
            <p className="mt-1 text-xs text-muted/70">
              {t("notifications.emptyDesc")}
            </p>
          </div>
        ) : (
          <div className="max-h-[360px] overflow-y-auto">
            {notifications.map((n) => (
              <button
                key={n.id}
                onClick={() => handleClick(n)}
                className="flex w-full items-start gap-3 px-4 py-3 text-left hover:bg-cream-light transition-colors border-b border-border last:border-b-0"
              >
                {!n.is_read && (
                  <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-brand-blue" />
                )}
                {n.is_read && <span className="mt-1.5 h-2 w-2 shrink-0" />}
                <div className="min-w-0 flex-1">
                  <p className={`text-sm truncate ${n.is_read ? "text-muted" : "text-heading font-medium"}`}>
                    {n.title}
                  </p>
                  {n.body && (
                    <p className="text-xs text-muted truncate mt-0.5">{n.body}</p>
                  )}
                  <p className="text-xs text-muted/60 mt-1">{relativeTime(n.created_at)}</p>
                </div>
              </button>
            ))}
          </div>
        )}
        <div className="border-t border-border px-4 py-2">
          <button
            onClick={() => { setOpen(false); navigate("/settings"); }}
            className="flex w-full items-center justify-center gap-1.5 rounded-md py-1.5 text-xs text-muted hover:text-brand-blue transition-colors"
          >
            <Cog6ToothIcon className="h-3.5 w-3.5" />
            Settings
          </button>
        </div>
      </PopoverContent>
    </Popover>
  );
}

const languages = [
  { code: 'en', label: 'English', flag: '\ud83c\uddec\ud83c\udde7' },
  { code: 'ar', label: '\u0627\u0644\u0639\u0631\u0628\u064a\u0629', flag: '\ud83c\uddf8\ud83c\udde6' },
  { code: 'fr', label: 'Fran\u00e7ais', flag: '\ud83c\uddeb\ud83c\uddf7' },
  { code: 'de', label: 'Deutsch', flag: '\ud83c\udde9\ud83c\uddea' },
  { code: 'es', label: 'Espa\u00f1ol', flag: '\ud83c\uddea\ud83c\uddf8' },
  { code: 'zh', label: '\u4e2d\u6587', flag: '\ud83c\udde8\ud83c\uddf3' },
];

function LanguageSwitcher() {
  const { i18n } = useTranslation();

  return (
    <Popover>
      <PopoverTrigger asChild>
        <button
          className="relative rounded-lg p-1.5 text-muted hover:text-body hover:bg-cream-light transition-colors"
          aria-label="Change language"
        >
          <GlobeAltIcon className="h-5 w-5" />
        </button>
      </PopoverTrigger>
      <PopoverContent align="end" className="w-48 p-1">
        {languages.map((lang) => (
          <button
            key={lang.code}
            onClick={() => i18n.changeLanguage(lang.code)}
            className={`flex w-full items-center gap-2 rounded-md px-3 py-2 text-sm transition-colors ${
              i18n.language === lang.code
                ? 'bg-brand-blue/10 text-brand-blue font-medium'
                : 'text-body hover:bg-cream-light'
            }`}
          >
            <span>{lang.flag}</span>
            <span>{lang.label}</span>
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}

const navLinkNested =
  "flex items-center gap-3 rounded-lg px-3 py-1.5 text-sm text-white/60 hover:bg-navy-light hover:text-white transition-colors pl-10";

function OrgNav({ pathname, onLinkClick }: { pathname: string; onLinkClick?: () => void }) {
  const [expanded, setExpanded] = useState(() => pathname.startsWith("/admin"));
  const { t } = useTranslation();
  const isOrgActive = pathname.startsWith("/admin");

  const orgLinks = [
    { to: "/admin/members", label: t("nav.members"), icon: UsersIcon },
    { to: "/admin/teams", label: t("nav.teams"), icon: UserGroupIcon },
    { to: "/admin/billing", label: t("nav.billing"), icon: CreditCardIcon },
    { to: "/admin/integrations", label: t("nav.integrations"), icon: LinkIcon },
    { to: "/admin/organization", label: t("nav.settings"), icon: Cog6ToothIcon },
  ];

  return (
    <div className="mt-2 space-y-1">
      <button
        onClick={() => setExpanded(!expanded)}
        className={`${navLink} w-full justify-between ${isOrgActive ? navLinkActive : ""}`}
      >
        <span className="flex items-center gap-3">
          <BuildingOffice2Icon className="h-5 w-5 shrink-0" />
          {t("nav.organization")}
        </span>
        <ChevronDownIcon
          className={`h-3.5 w-3.5 transition-transform ${expanded ? "rotate-0" : "-rotate-90"}`}
        />
      </button>
      {expanded && (
        <div className="space-y-0.5 mt-1">
          {orgLinks.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={onLinkClick}
              className={`${navLinkNested} ${pathname === item.to ? "text-white bg-navy-light" : ""}`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          ))}
        </div>
      )}
    </div>
  );
}

function PlanBadge() {
  const { sessionClaims } = useAuth();
  const planClaim = (sessionClaims as Record<string, unknown>)?.pla as string | undefined;
  const plan = planClaim?.replace("o:", "") || "free";

  const badgeColors: Record<string, string> = {
    enterprise: "bg-brand-gold/20 text-brand-gold",
    growth: "bg-brand-blue/20 text-brand-blue",
    starter: "bg-white/20 text-white/80",
    free: "bg-white/10 text-white/60",
    free_org: "bg-white/10 text-white/60",
  };

  const colorClass = badgeColors[plan] || "bg-white/10 text-white/50";
  const label = plan.charAt(0).toUpperCase() + plan.slice(1);

  return (
    <div className="px-4 pb-4">
      <div className="flex items-center gap-2 rounded-lg bg-navy-light px-3 py-2">
        <span className={`inline-flex items-center rounded-md px-2 py-0.5 text-xs font-semibold ${colorClass}`}>
          {label}
        </span>
        <span className="text-xs text-white/50">Plan</span>
      </div>
    </div>
  );
}

function SidebarContent({
  onLinkClick,
}: {
  onLinkClick?: () => void;
}) {
  const location = useLocation();
  const { membership } = useOrganization();
  const branding = useBrandingContext();
  const { t } = useTranslation();

  const isAdmin = membership?.role === "org:admin";

  const navItems = [
    { to: "/dashboard", label: t("nav.dashboard"), icon: Squares2X2Icon, match: (p: string) => p === "/" || p === "/dashboard" },
    { to: "/knowledge-base", label: t("nav.knowledgeBase"), icon: BookOpenIcon, match: (p: string) => p.startsWith("/knowledge-base") },
    { to: "/rfp/new", label: t("nav.newRfp"), icon: DocumentPlusIcon, match: (p: string) => p === "/rfp/new" },
    { to: "/chat", label: t("nav.chat"), icon: ChatBubbleLeftEllipsisIcon, match: (p: string) => p.startsWith("/chat") },
    { to: "/analytics", label: t("nav.analytics"), icon: ChartBarIcon, match: (p: string) => p === "/analytics" },
    { to: "/admin/audit", label: t("nav.auditLog"), icon: ClipboardDocumentListIcon, match: (p: string) => p === "/admin/audit" },
    { to: "/settings", label: "Settings", icon: Cog6ToothIcon, match: (p: string) => p === "/settings" },
  ];

  return (
    <>
      {/* Logo */}
      <div className="flex h-14 items-center justify-center border-b border-navy-light px-4">
        <Link
          to="/dashboard"
          onClick={onLinkClick}
          className="flex items-center gap-2"
        >
          {branding?.logo_url ? (
            <img
              src={branding.logo_url}
              alt={branding.display_name ?? "Logo"}
              className="h-8 w-auto max-w-[160px] object-contain"
            />
          ) : (
            <span className="font-logo text-[22px] font-bold tracking-tight uppercase text-white">
              {branding?.display_name ?? import.meta.env.VITE_BUSINESS_NAME ?? "Spondic"}
            </span>
          )}
        </Link>
      </div>

      {/* Main Nav */}
      <nav className="flex-1 p-4 space-y-1" data-tour="sidebar-nav">
        {navItems.map((item) => (
          <Link
            key={item.to}
            to={item.to}
            onClick={onLinkClick}
            className={`${navLink} ${item.match(location.pathname) ? navLinkActive : ""}`}
          >
            <item.icon className="h-5 w-5 shrink-0" />
            {item.label}
          </Link>
        ))}

        {/* Organization — nested under main nav, admin-only */}
        {isAdmin && (
          <OrgNav pathname={location.pathname} onLinkClick={onLinkClick} />
        )}
      </nav>

      {/* Plan badge at bottom of sidebar */}
      <PlanBadge />
    </>
  );
}

export function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  useAppEvents();

  return (
    <div className="flex min-h-screen bg-cream text-heading font-sans">
      {/* Desktop Sidebar */}
      <aside className="hidden lg:flex w-56 flex-col border-r border-navy-light bg-navy sticky top-0 h-screen overflow-y-auto">
        <SidebarContent />
      </aside>

      {/* Mobile Overlay */}
      {mobileOpen && (
        <div className="fixed inset-0 z-40 lg:hidden">
          {/* Backdrop */}
          <div
            className="absolute inset-0 bg-black/50"
            onClick={() => setMobileOpen(false)}
          />
          {/* Drawer */}
          <aside className="relative flex w-64 max-w-[80vw] h-full flex-col bg-navy shadow-xl">
            <button
              onClick={() => setMobileOpen(false)}
              className="absolute right-3 top-3 z-10 rounded-lg p-1 text-white/50 hover:text-white hover:bg-navy-light transition-colors"
            >
              <XMarkIcon className="h-5 w-5" />
            </button>
            <SidebarContent onLinkClick={() => setMobileOpen(false)} />
          </aside>
        </div>
      )}

      <div className="flex flex-1 flex-col min-w-0">
        {/* Header */}
        <header className="flex h-14 shrink-0 items-center gap-3 border-b border-border px-4 lg:px-6 bg-cream">
          {/* Mobile hamburger */}
          <button
            onClick={() => setMobileOpen(true)}
            className="lg:hidden rounded-lg p-1.5 text-body hover:bg-cream-light transition-colors"
            aria-label="Open navigation"
          >
            <Bars3Icon className="h-5 w-5" />
          </button>

          {/* Breadcrumbs */}
          <div className="hidden sm:block flex-1 min-w-0">
            <Breadcrumbs />
          </div>

          {/* Mobile: just page title */}
          <div className="sm:hidden flex-1 min-w-0">
            <MobilePageTitle />
          </div>

          {/* Right side */}
          <div className="flex items-center gap-3 shrink-0">
            {/* Language Switcher */}
            <LanguageSwitcher />

            {/* Notifications */}
            <NotificationBell />

            <UserButton />
          </div>
        </header>

        <main className="flex flex-1 flex-col min-h-0 p-4 lg:p-6 bg-cream-lighter">
          <div className="mx-auto w-full max-w-[1800px] flex flex-1 flex-col min-h-0">
            <Outlet />
          </div>
        </main>
      </div>
    </div>
  );
}

function MobilePageTitle() {
  const crumbs = useBreadcrumbs();
  const last = crumbs[crumbs.length - 1];
  return (
    <span className="text-sm font-medium text-heading truncate">
      {last?.label ?? ""}
    </span>
  );
}
