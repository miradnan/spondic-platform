"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";

function CheckMark({ white }: { white?: boolean }) {
  return (
    <svg
      className={`h-4 w-4 shrink-0 ${white ? "text-white" : "text-brand-blue"}`}
      fill="currentColor"
      viewBox="0 0 20 20"
    >
      <path
        fillRule="evenodd"
        d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
        clipRule="evenodd"
      />
    </svg>
  );
}

export default function PricingPageContent() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.spondic.com";
  const trialPeriod = process.env.NEXT_PUBLIC_TRIAL_PERIOD ?? "30";
  const { t } = useTranslation();

  return (
    <main className="min-h-[60vh]">
      <section className="py-12 sm:py-20 lg:py-28">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-gold">
            {t("pricing.label")}
          </p>
          <h1 className="mt-4 max-w-[520px] font-display text-[2rem] font-black italic leading-[1.08] sm:text-[2.8rem] lg:text-[3.2rem]">
            {t("pricing.title")}
          </h1>
          <p className="mt-5 text-[15px] text-body">
            {t("pricing.subtitle", { days: trialPeriod })}
          </p>

          <div className="mt-10 grid items-start gap-6 sm:mt-16 sm:gap-8 sm:grid-cols-3">
            {/* Starter */}
            <div className="rounded-2xl border border-[#d8d4cb] bg-white px-7 pb-8 pt-7">
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted">{t("pricing.starter")}</p>
              <p className="mt-5 font-display text-[4rem] font-black italic leading-none text-[#141413]">$299</p>
              <p className="mt-1 text-[13px] text-muted">{t("pricing.perMonth")}</p>
              <ul className="mt-7 space-y-3.5 text-[13px] text-body">
                {[t("pricing.starter1"), t("pricing.starter2"), t("pricing.starter3"), t("pricing.starter4")].map((f) => (
                  <li key={f} className="flex items-center gap-2.5">
                    <CheckMark />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={appUrl}
                className="mt-8 block rounded-lg border-2 border-[#141413]/15 py-3 text-center text-[13px] font-semibold text-[#141413] hover:border-brand-blue hover:text-brand-blue transition-colors"
              >
                {t("pricing.getStarted")}
              </Link>
            </div>

            {/* Growth — highlighted */}
            <div className="relative rounded-2xl bg-brand-blue px-7 pb-8 pt-7 text-white">
              <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-brand-gold px-5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white shadow-sm">
                {t("pricing.mostPopular")}
              </span>
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/60">{t("pricing.growth")}</p>
              <p className="mt-5 font-display text-[4rem] font-black italic leading-none">$799</p>
              <p className="mt-1 text-[13px] text-white/60">{t("pricing.perMonth")}</p>
              <ul className="mt-7 space-y-3.5 text-[13px]">
                {[t("pricing.growth1"), t("pricing.growth2"), t("pricing.growth3"), t("pricing.growth4"), t("pricing.growth5")].map((f) => (
                  <li key={f} className="flex items-center gap-2.5">
                    <CheckMark white />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={appUrl}
                className="mt-8 block rounded-lg bg-white py-3 text-center text-[13px] font-semibold text-brand-blue hover:bg-white/90 transition-colors"
              >
                {t("pricing.getStarted")}
              </Link>
            </div>

            {/* Enterprise */}
            <div className="rounded-2xl border border-[#d8d4cb] bg-white px-7 pb-8 pt-7">
              <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted">{t("pricing.enterprise")}</p>
              <p className="mt-5 font-display text-[4rem] font-black italic leading-none text-[#141413]">{t("pricing.custom")}</p>
              <p className="mt-1 text-[13px] text-muted">{t("pricing.perMonth")}</p>
              <ul className="mt-7 space-y-3.5 text-[13px] text-body">
                {[t("pricing.enterprise1"), t("pricing.enterprise2"), t("pricing.enterprise3"), t("pricing.enterprise4"), t("pricing.enterprise5")].map((f) => (
                  <li key={f} className="flex items-center gap-2.5">
                    <CheckMark />
                    {f}
                  </li>
                ))}
              </ul>
              <Link
                href={appUrl}
                className="mt-8 block rounded-lg border-2 border-brand-blue py-3 text-center text-[13px] font-semibold text-brand-blue hover:bg-brand-blue hover:text-white transition-colors"
              >
                {t("pricing.talkToUs")}
              </Link>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
