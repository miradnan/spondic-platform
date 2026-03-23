"use client";

import { useTranslation } from "react-i18next";
import ScrollReveal from "./ScrollReveal";

export default function TrustBadges() {
  const { t } = useTranslation();

  const features = [
    {
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M16.5 10.5V6.75a4.5 4.5 0 10-9 0v3.75m-.75 11.25h10.5a2.25 2.25 0 002.25-2.25v-6.75a2.25 2.25 0 00-2.25-2.25H6.75a2.25 2.25 0 00-2.25 2.25v6.75a2.25 2.25 0 002.25 2.25z" />
        </svg>
      ),
      title: t("trustBadges.aes256Title"),
      desc: t("trustBadges.aes256Desc"),
    },
    {
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
        </svg>
      ),
      title: t("trustBadges.tenantTitle"),
      desc: t("trustBadges.tenantDesc"),
    },
    {
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M12 21a9.004 9.004 0 008.716-6.747M12 21a9.004 9.004 0 01-8.716-6.747M12 21c2.485 0 4.5-4.03 4.5-9S14.485 3 12 3m0 18c-2.485 0-4.5-4.03-4.5-9S9.515 3 12 3m0 0a8.997 8.997 0 017.843 4.582M12 3a8.997 8.997 0 00-7.843 4.582m15.686 0A11.953 11.953 0 0112 10.5c-2.998 0-5.74-1.1-7.843-2.918m15.686 0A8.959 8.959 0 0121 9.75c0 .746-.092 1.472-.262 2.165M3.26 11.915A8.972 8.972 0 013 9.75c0-.746.092-1.472.262-2.168" />
        </svg>
      ),
      title: t("trustBadges.gdprTitle"),
      desc: t("trustBadges.gdprDesc"),
    },
    {
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M9.75 3.104v5.714a2.25 2.25 0 01-.659 1.591L5 14.5M9.75 3.104c-.251.023-.501.05-.75.082m.75-.082a24.301 24.301 0 014.5 0m0 0v5.714c0 .597.237 1.17.659 1.591L19.8 15.3M14.25 3.104c.251.023.501.05.75.082M19.8 15.3l-1.57.393A9.065 9.065 0 0112 15a9.065 9.065 0 00-6.23.693L5 14.5m14.8.8l1.402 1.402c1.232 1.232.65 3.318-1.067 3.611A48.309 48.309 0 0112 21c-2.773 0-5.491-.235-8.135-.687-1.718-.293-2.3-2.379-1.067-3.61L5 14.5" />
        </svg>
      ),
      title: t("trustBadges.noAiTitle"),
      desc: t("trustBadges.noAiDesc"),
    },
    {
      icon: (
        <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
          <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m0 12.75h7.5m-7.5 3H12M10.5 2.25H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
        </svg>
      ),
      title: t("trustBadges.auditTitle"),
      desc: t("trustBadges.auditDesc"),
    },
  ];

  return (
    <div className="flex flex-col items-center gap-4">
      {/* Top row: 3 cards */}
      <div className="grid w-full gap-4 grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3">
        {features.slice(0, 3).map((f, i) => (
          <ScrollReveal key={f.title} delay={i * 100}>
            <div className="group flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-6 py-7 text-center backdrop-blur-sm transition-colors hover:bg-white/[0.1]">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-gold/15 text-brand-gold">
                {f.icon}
              </div>
              <div>
                <p className="text-[14px] font-semibold text-white">{f.title}</p>
                <p className="mt-1.5 text-[12px] leading-[1.6] text-white/55">{f.desc}</p>
              </div>
            </div>
          </ScrollReveal>
        ))}
      </div>
      {/* Bottom row: 2 cards, centered */}
      <div className="grid w-full gap-4 sm:grid-cols-2 lg:w-2/3">
        {features.slice(3).map((f, i) => (
          <ScrollReveal key={f.title} delay={(i + 3) * 100}>
            <div className="group flex flex-col items-center gap-3 rounded-2xl border border-white/10 bg-white/[0.06] px-6 py-7 text-center backdrop-blur-sm transition-colors hover:bg-white/[0.1]">
              <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-brand-gold/15 text-brand-gold">
                {f.icon}
              </div>
              <div>
                <p className="text-[14px] font-semibold text-white">{f.title}</p>
                <p className="mt-1.5 text-[12px] leading-[1.6] text-white/55">{f.desc}</p>
              </div>
            </div>
          </ScrollReveal>
        ))}
      </div>
    </div>
  );
}
