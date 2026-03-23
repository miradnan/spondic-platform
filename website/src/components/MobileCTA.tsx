"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";

export default function MobileCTA() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.spondic.com";
  const [visible, setVisible] = useState(false);
  const { t } = useTranslation();

  useEffect(() => {
    const onScroll = () => setVisible(window.scrollY > 600);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  if (!visible) return null;

  return (
    <div className="fixed bottom-0 left-0 right-0 z-50 border-t border-[#d8d4cb] bg-white/95 px-4 py-3 pb-[max(0.75rem,env(safe-area-inset-bottom))] backdrop-blur-sm md:hidden">
      <div className="flex items-center gap-3">
        <Link
          href={appUrl}
          className="flex-1 rounded-lg bg-brand-blue py-3 text-center text-[13px] font-semibold text-white shadow-lg shadow-brand-blue/25 hover:bg-brand-blue-hover transition-colors"
        >
          {t("mobileCta.startFreeTrial")}
        </Link>
        <Link
          href="/contact"
          className="rounded-lg border-2 border-[#141413]/15 px-5 py-2.5 text-[13px] font-semibold text-[#141413] hover:border-brand-blue hover:text-brand-blue transition-colors"
        >
          {t("mobileCta.demo")}
        </Link>
      </div>
    </div>
  );
}
