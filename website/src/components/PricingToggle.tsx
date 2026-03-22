"use client";

import Link from "next/link";
import { useState } from "react";
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

export default function PricingToggle({ appUrl }: { appUrl: string }) {
  const [annual, setAnnual] = useState(false);
  const { t } = useTranslation();

  const starter = annual ? { price: "$249", period: t("pricing.billedAnnually"), saving: t("pricing.save17") } : { price: "$299", period: t("pricing.perMonth"), saving: "" };
  const growth = annual ? { price: "$649", period: t("pricing.billedAnnually"), saving: t("pricing.save19") } : { price: "$799", period: t("pricing.perMonth"), saving: "" };

  return (
    <>
      {/* Toggle */}
      <div className="mt-8 flex items-center justify-center gap-4 sm:justify-start">
        <button
          onClick={() => setAnnual(false)}
          className={`text-[14px] font-semibold transition-colors ${!annual ? "text-[#141413]" : "text-muted hover:text-[#141413]"}`}
        >
          {t("pricing.monthly")}
        </button>
        <button
          onClick={() => setAnnual(!annual)}
          className={`relative inline-flex h-7 w-12 shrink-0 items-center rounded-full transition-colors ${annual ? "bg-brand-blue" : "bg-[#d8d4cb]"}`}
          aria-label="Toggle annual pricing"
        >
          <span className={`inline-block h-5 w-5 rounded-full bg-white shadow-sm transition-transform ${annual ? "translate-x-6" : "translate-x-1"}`} />
        </button>
        <button
          onClick={() => setAnnual(true)}
          className={`text-[14px] font-semibold transition-colors ${annual ? "text-[#141413]" : "text-muted hover:text-[#141413]"}`}
        >
          {t("pricing.annual")}
          <span className="ml-1.5 rounded-full bg-brand-gold/15 px-2 py-0.5 text-[10px] font-bold text-brand-gold">
            {t("pricing.save20")}
          </span>
        </button>
      </div>

      <div className="mt-10 grid items-start gap-6 sm:mt-12 sm:gap-8 sm:grid-cols-3">
        {/* Starter */}
        <div className="rounded-2xl border border-[#d8d4cb] bg-white px-7 pb-8 pt-7">
          <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted">{t("pricing.starter")}</p>
          <p className="mt-5 font-display text-[4rem] font-black italic leading-none text-[#141413]">{starter.price}</p>
          <p className="mt-1 text-[13px] text-muted">{starter.period}</p>
          {starter.saving && <p className="mt-1 text-[11px] font-semibold text-brand-gold">{starter.saving}</p>}
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
            {t("pricing.startWinning")}
          </Link>
          <p className="mt-2 text-center text-[11px] text-muted">{t("pricing.noCreditCard")}</p>
        </div>

        {/* Growth — highlighted */}
        <div className="relative rounded-2xl bg-brand-blue px-7 pb-8 pt-7 text-white">
          <span className="absolute -top-3.5 left-1/2 -translate-x-1/2 rounded-full bg-brand-gold px-5 py-1 text-[10px] font-bold uppercase tracking-[0.12em] text-white shadow-sm">
            {annual ? t("pricing.bestValue") : t("pricing.mostPopular")}
          </span>
          <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-white/60">{t("pricing.growth")}</p>
          <p className="mt-5 font-display text-[4rem] font-black italic leading-none">{growth.price}</p>
          <p className="mt-1 text-[13px] text-white/60">{growth.period}</p>
          {growth.saving && <p className="mt-1 text-[11px] font-semibold text-brand-gold">{growth.saving} ({annual ? t("pricing.saveAnnual") : ""})</p>}
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
            {t("pricing.startWinning")}
          </Link>
          <p className="mt-2 text-center text-[11px] text-white/50">{t("pricing.noCreditCard")}</p>
        </div>

        {/* Enterprise */}
        <div className="rounded-2xl border border-[#d8d4cb] bg-white px-7 pb-8 pt-7">
          <p className="text-[11px] font-bold uppercase tracking-[0.15em] text-muted">{t("pricing.enterprise")}</p>
          <p className="mt-5 font-display text-[4rem] font-black italic leading-none text-[#141413]">{t("pricing.custom")}</p>
          <p className="mt-1 text-[13px] text-muted">{t("pricing.tailoredToTeam")}</p>
          <ul className="mt-7 space-y-3.5 text-[13px] text-body">
            {[t("pricing.enterprise1"), t("pricing.enterprise2"), t("pricing.enterprise3"), t("pricing.enterprise4"), t("pricing.enterprise5")].map((f) => (
              <li key={f} className="flex items-center gap-2.5">
                <CheckMark />
                {f}
              </li>
            ))}
          </ul>
          <Link
            href="/contact"
            className="mt-8 block rounded-lg border-2 border-brand-blue py-3 text-center text-[13px] font-semibold text-brand-blue hover:bg-brand-blue hover:text-white transition-colors"
          >
            {t("pricing.talkToUs")}
          </Link>
        </div>
      </div>
    </>
  );
}
