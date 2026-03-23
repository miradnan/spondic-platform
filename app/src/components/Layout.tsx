import { useState, useEffect, useCallback, useRef } from "react";
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
  BellIcon,
  LinkIcon,
  GlobeAltIcon,
  MagnifyingGlassIcon,
  SunIcon,
  MoonIcon,
} from "@heroicons/react/24/outline";
import { CheckIcon } from "@heroicons/react/24/solid";
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
  const { data: notifData } = useNotifications({ limit: 20 });
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
          <div className="max-h-[400px] overflow-y-auto">
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
        <div className="border-t border-border px-4 py-2 flex items-center gap-2">
          <button
            onClick={() => { setOpen(false); navigate("/notifications"); }}
            className="flex flex-1 items-center justify-center gap-1.5 rounded-md py-1.5 text-xs font-medium text-brand-blue hover:text-brand-blue-hover hover:bg-brand-blue/5 transition-colors"
          >
            View all notifications
          </button>
          <span className="h-4 w-px bg-border" />
          <button
            onClick={() => { setOpen(false); navigate("/settings"); }}
            className="flex items-center justify-center gap-1.5 rounded-md py-1.5 px-2 text-xs text-muted hover:text-brand-blue transition-colors"
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
            <span className="flex-1 text-left">{lang.label}</span>
            {i18n.language === lang.code && (
              <CheckIcon className="h-4 w-4 text-brand-blue shrink-0" />
            )}
          </button>
        ))}
      </PopoverContent>
    </Popover>
  );
}


function OrgNav({ pathname, onLinkClick }: { pathname: string; onLinkClick?: () => void }) {
  const [expanded, setExpanded] = useState(() => pathname.startsWith("/admin"));
  const { t } = useTranslation();
  const isOrgActive = pathname.startsWith("/admin");

  const orgLinks = [
    { to: "/admin/members", label: t("nav.members"), icon: UsersIcon },
    { to: "/admin/teams", label: t("nav.teams"), icon: UserGroupIcon },
    { to: "/admin/billing", label: t("nav.billing"), icon: CreditCardIcon },
    { to: "/admin/integrations", label: t("nav.integrations"), icon: LinkIcon },
    { to: "/admin/organization", label: "Org Settings", icon: Cog6ToothIcon },
  ];

  return (
    <div className="mt-4">
      {/* Section label */}
      <div className="flex items-center gap-2 px-3 mb-2">
        <span className="text-[10px] font-semibold uppercase tracking-widest text-white/40">Admin</span>
        <span className="inline-flex items-center rounded px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide bg-brand-gold/20 text-brand-gold">
          Admin
        </span>
        <div className="flex-1 h-px bg-white/10" />
      </div>

      {/* Toggle button */}
      <button
        onClick={() => setExpanded(!expanded)}
        className={`${navLink} w-full justify-between ${isOrgActive ? navLinkActive : ""}`}
      >
        <span className="flex items-center gap-3">
          <BuildingOffice2Icon className="h-5 w-5 shrink-0" />
          {t("nav.organization")}
        </span>
        <ChevronRightIcon
          className={`h-4 w-4 transition-transform duration-200 ${expanded ? "rotate-90" : "rotate-0"}`}
        />
      </button>

      {/* Expandable sub-items */}
      <div
        className={`overflow-hidden transition-all duration-200 ease-in-out ${
          expanded ? "max-h-[300px] opacity-100" : "max-h-0 opacity-0"
        }`}
      >
        <div className="mt-1 ml-3 space-y-0.5 border-l border-white/10 pl-0">
          {orgLinks.map((item) => (
            <Link
              key={item.to}
              to={item.to}
              onClick={onLinkClick}
              className={`flex items-center gap-3 rounded-r-lg px-3 py-1.5 text-sm transition-colors ${
                pathname === item.to
                  ? "text-white bg-navy-light border-l-2 border-brand-gold -ml-px"
                  : "text-white/50 hover:bg-navy-light hover:text-white/80"
              }`}
            >
              <item.icon className="h-4 w-4 shrink-0" />
              {item.label}
            </Link>
          ))}
        </div>
      </div>
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

/* ---- Command Palette (Cmd+K) ---- */

interface CommandItem {
  label: string;
  to: string;
  icon: React.ComponentType<React.SVGProps<SVGSVGElement>>;
}

const commandItems: CommandItem[] = [
  { label: "Dashboard", to: "/dashboard", icon: Squares2X2Icon },
  { label: "Knowledge Base", to: "/knowledge-base", icon: BookOpenIcon },
  { label: "Chat", to: "/chat", icon: ChatBubbleLeftEllipsisIcon },
  { label: "New RFP", to: "/rfp/new", icon: DocumentPlusIcon },
  { label: "Analytics", to: "/analytics", icon: ChartBarIcon },
  { label: "Settings", to: "/settings", icon: Cog6ToothIcon },
  { label: "Members", to: "/admin/members", icon: UsersIcon },
  { label: "Teams", to: "/admin/teams", icon: UserGroupIcon },
  { label: "Billing", to: "/admin/billing", icon: CreditCardIcon },
  { label: "Integrations", to: "/admin/integrations", icon: LinkIcon },
  { label: "Audit Log", to: "/admin/audit", icon: ClipboardDocumentListIcon },
  { label: "Organization Settings", to: "/admin/organization", icon: BuildingOffice2Icon },
];

function CommandPaletteInner({ onClose }: { onClose: () => void }) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [query, setQuery] = useState("");
  const [activeIndex, setActiveIndex] = useState(0);
  const navigate = useNavigate();

  const filtered = query.trim()
    ? commandItems.filter((item) =>
        item.label.toLowerCase().includes(query.toLowerCase())
      )
    : commandItems;

  const handleQueryChange = useCallback((value: string) => {
    setQuery(value);
    setActiveIndex(0);
  }, []);

  const select = useCallback(
    (item: CommandItem) => {
      onClose();
      navigate(item.to);
    },
    [navigate, onClose]
  );

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") {
      e.preventDefault();
      setActiveIndex((i) => (i + 1) % filtered.length);
    } else if (e.key === "ArrowUp") {
      e.preventDefault();
      setActiveIndex((i) => (i - 1 + filtered.length) % filtered.length);
    } else if (e.key === "Enter" && filtered[activeIndex]) {
      e.preventDefault();
      select(filtered[activeIndex]);
    } else if (e.key === "Escape") {
      e.preventDefault();
      onClose();
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-start justify-center pt-[20vh]">
      {/* Backdrop */}
      <div className="absolute inset-0 bg-black/50" onClick={onClose} />
      {/* Dialog */}
      <div
        className="relative w-full max-w-lg rounded-xl border border-border bg-cream shadow-2xl overflow-hidden"
        role="dialog"
        aria-label="Command palette"
      >
        <div className="flex items-center gap-3 border-b border-border px-4 py-3">
          <MagnifyingGlassIcon className="h-5 w-5 text-muted shrink-0" />
          <input
            ref={inputRef}
            type="text"
            value={query}
            autoFocus
            onChange={(e) => handleQueryChange(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Search pages..."
            style={{ boxShadow: "none" }}
            className="flex-1 bg-transparent text-base text-heading placeholder:text-muted outline-none ring-0 border-none shadow-none focus:outline-none focus:ring-0 focus:shadow-none"
          />
          <kbd className="hidden sm:inline-flex items-center gap-0.5 rounded border border-border bg-cream-light px-1.5 py-0.5 text-[10px] font-medium text-muted">
            ESC
          </kbd>
        </div>
        <div className="max-h-[300px] overflow-y-auto p-2">
          {filtered.length === 0 ? (
            <p className="px-3 py-6 text-center text-sm text-muted">No results found</p>
          ) : (
            filtered.map((item, i) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.to}
                  onClick={() => select(item)}
                  onMouseEnter={() => setActiveIndex(i)}
                  className={`flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm transition-colors ${
                    i === activeIndex
                      ? "bg-brand-blue/10 text-brand-blue"
                      : "text-body hover:bg-cream-light"
                  }`}
                >
                  <Icon className="h-4.5 w-4.5 shrink-0" />
                  {item.label}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function CommandPalette({ open, onClose }: { open: boolean; onClose: () => void }) {
  if (!open) return null;
  return <CommandPaletteInner onClose={onClose} />;
}

/* ---- Dark Mode Toggle ---- */

function useDarkMode() {
  const [dark, setDark] = useState(() => {
    if (typeof window === "undefined") return false;
    const stored = localStorage.getItem("theme");
    if (stored === "dark") return true;
    if (stored === "light") return false;
    return window.matchMedia("(prefers-color-scheme: dark)").matches;
  });

  useEffect(() => {
    const root = document.documentElement;
    if (dark) {
      root.classList.add("dark");
      localStorage.setItem("theme", "dark");
    } else {
      root.classList.remove("dark");
      localStorage.setItem("theme", "light");
    }
  }, [dark]);

  return [dark, setDark] as const;
}

function DarkModeToggle() {
  const [dark, setDark] = useDarkMode();

  return (
    <button
      onClick={() => setDark(!dark)}
      className="rounded-lg p-1.5 text-muted hover:text-body hover:bg-cream-light transition-colors"
      aria-label={dark ? "Switch to light mode" : "Switch to dark mode"}
    >
      {dark ? (
        <SunIcon className="h-5 w-5" />
      ) : (
        <MoonIcon className="h-5 w-5" />
      )}
    </button>
  );
}

/* ---- Sidebar with grouped navigation ---- */

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

  const workspaceItems = [
    { to: "/dashboard", label: t("nav.dashboard"), icon: Squares2X2Icon, match: (p: string) => p === "/" || p === "/dashboard" },
    { to: "/knowledge-base", label: t("nav.knowledgeBase"), icon: BookOpenIcon, match: (p: string) => p.startsWith("/knowledge-base") },
    { to: "/chat", label: t("nav.chat"), icon: ChatBubbleLeftEllipsisIcon, match: (p: string) => p.startsWith("/chat") },
  ];

  const createItems = [
    { to: "/rfp/new", label: t("nav.newRfp"), icon: DocumentPlusIcon, match: (p: string) => p === "/rfp/new" },
  ];

  const insightsItems = [
    { to: "/analytics", label: t("nav.analytics"), icon: ChartBarIcon, match: (p: string) => p === "/analytics" },
    { to: "/admin/audit", label: t("nav.auditLog"), icon: ClipboardDocumentListIcon, match: (p: string) => p === "/admin/audit" },
  ];

  const renderNavGroup = (
    label: string,
    items: typeof workspaceItems,
    showDivider: boolean
  ) => (
    <div className={showDivider ? "mt-4 pt-4 border-t border-white/10" : ""}>
      <p className="px-3 mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-white/40">
        {label}
      </p>
      <div className="space-y-0.5">
        {items.map((item) => (
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
      </div>
    </div>
  );

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
      <nav className="flex-1 p-4" data-tour="sidebar-nav">
        {renderNavGroup("Workspace", workspaceItems, false)}
        {renderNavGroup("Create", createItems, true)}
        {renderNavGroup("Insights", insightsItems, true)}

        {/* Organization -- admin-only */}
        {isAdmin && (
          <OrgNav pathname={location.pathname} onLinkClick={onLinkClick} />
        )}
      </nav>

      {/* Settings — pinned above plan badge */}
      <div className="px-4 pb-2">
        <Link
          to="/settings"
          onClick={onLinkClick}
          className={`${navLink} ${location.pathname === "/settings" ? navLinkActive : ""}`}
        >
          <Cog6ToothIcon className="h-5 w-5 shrink-0" />
          {t("nav.settings")}
        </Link>
      </div>

      {/* Plan badge at bottom of sidebar */}
      <PlanBadge />
    </>
  );
}

export function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);
  const [cmdPaletteOpen, setCmdPaletteOpen] = useState(false);
  useAppEvents();

  // Cmd+K / Ctrl+K keyboard shortcut
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.metaKey || e.ctrlKey) && e.key === "k") {
        e.preventDefault();
        setCmdPaletteOpen((prev) => !prev);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

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

          {/* Breadcrumbs (desktop) */}
          <div className="hidden sm:flex flex-1 items-center gap-3 min-w-0">
            <Breadcrumbs />
          </div>

          {/* Mobile breadcrumbs: show full breadcrumb trail compactly */}
          <div className="sm:hidden flex-1 min-w-0">
            <MobileBreadcrumbs />
          </div>

          {/* Right side */}
          <div className="flex items-center gap-1.5 sm:gap-3 shrink-0">
            {/* Cmd+K trigger */}
            <button
              onClick={() => setCmdPaletteOpen(true)}
              className="hidden sm:flex items-center gap-2 rounded-lg border border-border bg-cream-light/50 px-2.5 py-1.5 text-xs text-muted hover:text-body hover:border-brand-blue/30 transition-colors"
              aria-label="Open command palette"
            >
              <MagnifyingGlassIcon className="h-3.5 w-3.5" />
              <span className="hidden md:inline">Search...</span>
              <kbd className="rounded border border-border bg-cream px-1 py-0.5 text-[10px] font-medium leading-none">
                {navigator.platform?.includes("Mac") ? "\u2318K" : "Ctrl+K"}
              </kbd>
            </button>
            <button
              onClick={() => setCmdPaletteOpen(true)}
              className="sm:hidden rounded-lg p-1.5 text-muted hover:text-body hover:bg-cream-light transition-colors"
              aria-label="Search"
            >
              <MagnifyingGlassIcon className="h-5 w-5" />
            </button>

            {/* Dark mode toggle */}
            <DarkModeToggle />

            {/* Language Switcher */}
            <LanguageSwitcher />

            {/* Notifications */}
            <NotificationBell />

            <UserButton />
          </div>
        </header>

        <main className="flex flex-1 flex-col min-h-0 p-4 lg:p-6 bg-cream-lighter">
          <Outlet />
        </main>
      </div>

      {/* Command Palette */}
      <CommandPalette open={cmdPaletteOpen} onClose={() => setCmdPaletteOpen(false)} />
    </div>
  );
}

function MobileBreadcrumbs() {
  const crumbs = useBreadcrumbs();

  if (crumbs.length <= 1) {
    const last = crumbs[crumbs.length - 1];
    return (
      <span className="text-sm font-medium text-heading truncate">
        {last?.label ?? ""}
      </span>
    );
  }

  return (
    <nav className="flex items-center gap-1 text-sm min-w-0" aria-label="Breadcrumb">
      {crumbs.map((crumb, i) => (
        <span key={i} className="flex items-center gap-1 min-w-0">
          {i > 0 && (
            <ChevronRightIcon className="h-3 w-3 text-muted shrink-0" />
          )}
          {i < crumbs.length - 1 ? (
            crumb.to ? (
              <Link to={crumb.to} className="text-muted text-xs shrink-0">
                {crumb.label}
              </Link>
            ) : (
              <span className="text-muted text-xs shrink-0">{crumb.label}</span>
            )
          ) : (
            <span className="font-medium text-heading truncate">
              {crumb.label}
            </span>
          )}
        </span>
      ))}
    </nav>
  );
}
