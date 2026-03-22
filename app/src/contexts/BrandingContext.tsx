import { createContext, useContext, useEffect } from "react";
import type { OrgBranding } from "../lib/types.ts";
import { useBranding } from "../hooks/useApi.ts";

const BrandingContext = createContext<OrgBranding | null>(null);

export function useBrandingContext() {
  return useContext(BrandingContext);
}

export function BrandingProvider({ children }: { children: React.ReactNode }) {
  const { data: branding } = useBranding();

  useEffect(() => {
    if (!branding) return;

    const root = document.documentElement;

    if (branding.primary_color) {
      root.style.setProperty("--color-brand-blue", branding.primary_color);
    }
    if (branding.secondary_color) {
      root.style.setProperty("--color-navy", branding.secondary_color);
    }
    if (branding.accent_color) {
      root.style.setProperty("--color-brand-gold", branding.accent_color);
    }

    // Update favicon if provided
    if (branding.favicon_url) {
      let link = document.querySelector<HTMLLinkElement>("link[rel~='icon']");
      if (!link) {
        link = document.createElement("link");
        link.rel = "icon";
        document.head.appendChild(link);
      }
      link.href = branding.favicon_url;
    }

    // Update document title with display name if provided
    if (branding.display_name) {
      const baseTitle = document.title.replace(/^[^|]+\|?\s*/, "");
      document.title = baseTitle
        ? `${branding.display_name} | ${baseTitle}`
        : branding.display_name;
    }

    // Cleanup: reset CSS vars when unmounting
    return () => {
      root.style.removeProperty("--color-brand-blue");
      root.style.removeProperty("--color-navy");
      root.style.removeProperty("--color-brand-gold");
    };
  }, [branding]);

  return (
    <BrandingContext.Provider value={branding ?? null}>
      {children}
    </BrandingContext.Provider>
  );
}
