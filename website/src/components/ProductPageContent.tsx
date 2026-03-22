"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import ScrollReveal from "./ScrollReveal";

export default function ProductPageContent() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.spondic.com";
  const businessName = process.env.NEXT_PUBLIC_BUSINESS_NAME || "Spondic";
  const { t } = useTranslation();

  return (
    <main className="min-h-[60vh]">
      <section className="border-b border-[#d8d4cb] bg-[#f7f5f0] py-12 sm:py-20 lg:py-28">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-gold">{t("product.label")}</p>
          <h1 className="mt-4 max-w-[620px] font-display text-[2rem] font-black italic leading-[1.08] sm:text-[2.8rem] lg:text-[3.2rem]">
            {t("product.title")}
          </h1>
          <p className="mt-6 max-w-[520px] text-[15px] leading-[1.7] text-body">
            {t("product.subtitle", { businessName })}
          </p>
          <div className="mt-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:gap-5">
            <Link
              href={appUrl}
              className="inline-flex justify-center rounded-md bg-brand-blue px-6 py-3 text-[13px] font-semibold text-white hover:bg-brand-blue-hover transition-colors sm:w-auto"
            >
              {t("product.ctaPrimary")}
            </Link>
            <Link
              href="/contact"
              className="inline-flex justify-center rounded-md border-2 border-[#141413]/15 px-6 py-2.5 text-[13px] font-semibold text-[#141413] hover:border-brand-blue hover:text-brand-blue transition-colors sm:w-auto"
            >
              {t("product.ctaSecondary")}
            </Link>
          </div>
          <p className="mt-3 text-[12px] text-muted">{t("product.noCreditCard")}</p>
        </div>
      </section>

      {/* How it works — 3 steps */}
      <section className="py-12 sm:py-16 lg:py-24">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-8">
          <h2 className="font-display text-[1.75rem] font-bold italic text-[#141413]">{t("product.stepsTitle")}</h2>
          <ul className="mt-8 grid gap-10 sm:grid-cols-2 lg:grid-cols-3">
            {[
              { step: "01", title: t("product.step1"), body: t("product.step1Desc", { businessName }) },
              { step: "02", title: t("product.step2"), body: t("product.step2Desc") },
              { step: "03", title: t("product.step3"), body: t("product.step3Desc") },
            ].map((s, i) => (
              <ScrollReveal key={s.step} delay={i * 100}>
                <li className="rounded-2xl border border-[#d8d4cb] bg-white px-6 py-6">
                  <span className="text-[11px] font-bold uppercase tracking-[0.15em] text-brand-gold">{s.step}</span>
                  <h3 className="mt-3 font-display text-[1.25rem] font-bold italic text-brand-blue">{s.title}</h3>
                  <p className="mt-3 text-[14px] leading-[1.6] text-body">{s.body}</p>
                </li>
              </ScrollReveal>
            ))}
          </ul>
        </div>
      </section>

      {/* Feature deep-dives */}
      <section className="border-y border-[#d8d4cb] bg-[#f7f5f0] py-12 sm:py-16 lg:py-24">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-gold">{t("product.featuresLabel")}</p>
          <h2 className="mt-4 font-display text-[1.75rem] font-bold italic text-[#141413] sm:text-[2.2rem]">
            {t("product.featuresTitle")}
          </h2>

          <div className="mt-12 grid gap-8 sm:grid-cols-2">
            {[
              {
                title: t("product.feat1Title"),
                desc: t("product.feat1Desc"),
                icon: (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375" />
                  </svg>
                ),
              },
              {
                title: t("product.feat2Title"),
                desc: t("product.feat2Desc"),
                icon: (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M13.19 8.688a4.5 4.5 0 011.242 7.244l-4.5 4.5a4.5 4.5 0 01-6.364-6.364l1.757-1.757m13.35-.622l1.757-1.757a4.5 4.5 0 00-6.364-6.364l-4.5 4.5a4.5 4.5 0 001.242 7.244" />
                  </svg>
                ),
              },
              {
                title: t("product.feat3Title"),
                desc: t("product.feat3Desc"),
                icon: (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M18 18.72a9.094 9.094 0 003.741-.479 3 3 0 00-4.682-2.72m.94 3.198l.001.031c0 .225-.012.447-.037.666A11.944 11.944 0 0112 21c-2.17 0-4.207-.576-5.963-1.584A6.062 6.062 0 016 18.719m12 0a5.971 5.971 0 00-.941-3.197m0 0A5.995 5.995 0 0012 12.75a5.995 5.995 0 00-5.058 2.772m0 0a3 3 0 00-4.681 2.72 8.986 8.986 0 003.74.477m.94-3.197a5.971 5.971 0 00-.94 3.197M15 6.75a3 3 0 11-6 0 3 3 0 016 0zm6 3a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0zm-13.5 0a2.25 2.25 0 11-4.5 0 2.25 2.25 0 014.5 0z" />
                  </svg>
                ),
              },
              {
                title: t("product.feat4Title"),
                desc: t("product.feat4Desc"),
                icon: (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5M16.5 12L12 16.5m0 0L7.5 12m4.5 4.5V3" />
                  </svg>
                ),
              },
              {
                title: t("product.feat5Title"),
                desc: t("product.feat5Desc"),
                icon: (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0l3.181 3.183a8.25 8.25 0 0013.803-3.7M4.031 9.865a8.25 8.25 0 0113.803-3.7l3.181 3.182M2.985 19.644l3.181-3.183" />
                  </svg>
                ),
              },
              {
                title: t("product.feat6Title"),
                desc: t("product.feat6Desc"),
                icon: (
                  <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                    <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                  </svg>
                ),
              },
            ].map((f, i) => (
              <ScrollReveal key={f.title} delay={i * 80}>
                <div className="flex gap-4 rounded-2xl border border-[#d8d4cb] bg-white px-6 py-6">
                  <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-xl bg-brand-blue/10 text-brand-blue">
                    {f.icon}
                  </div>
                  <div>
                    <h3 className="text-[14px] font-bold text-[#141413]">{f.title}</h3>
                    <p className="mt-2 text-[13px] leading-[1.7] text-body">{f.desc}</p>
                  </div>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* Before / After */}
      <section className="py-12 sm:py-16 lg:py-24">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-8">
          <ScrollReveal>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-gold">{t("product.differenceLabel")}</p>
            <h2 className="mt-4 font-display text-[1.75rem] font-bold italic text-[#141413] sm:text-[2.2rem]">
              {t("product.differenceTitle", { businessName })}
            </h2>
          </ScrollReveal>

          <div className="mt-10 grid gap-6 sm:grid-cols-2">
            <ScrollReveal delay={0}>
              <div className="rounded-2xl border border-red-200 bg-red-50/50 px-7 py-8">
                <p className="text-[12px] font-bold uppercase tracking-[0.15em] text-red-600">{t("product.withoutTitle", { businessName })}</p>
                <ul className="mt-5 space-y-3 text-[13px] text-body">
                  {[
                    t("product.without1"),
                    t("product.without2"),
                    t("product.without3"),
                    t("product.without4"),
                    t("product.without5"),
                    t("product.without6"),
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <svg className="mt-0.5 h-4 w-4 shrink-0 text-red-400" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={2}>
                        <path strokeLinecap="round" strokeLinejoin="round" d="M6 18L18 6M6 6l12 12" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </ScrollReveal>
            <ScrollReveal delay={120}>
              <div className="rounded-2xl border border-green-200 bg-green-50/50 px-7 py-8">
                <p className="text-[12px] font-bold uppercase tracking-[0.15em] text-green-700">{t("product.withTitle", { businessName })}</p>
                <ul className="mt-5 space-y-3 text-[13px] text-body">
                  {[
                    t("product.with1"),
                    t("product.with2"),
                    t("product.with3"),
                    t("product.with4"),
                    t("product.with5"),
                    t("product.with6"),
                  ].map((item) => (
                    <li key={item} className="flex items-start gap-2.5">
                      <svg className="mt-0.5 h-4 w-4 shrink-0 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                        <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
                      </svg>
                      {item}
                    </li>
                  ))}
                </ul>
              </div>
            </ScrollReveal>
          </div>
        </div>
      </section>

      {/* CTA */}
      <section className="bg-navy py-12 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-[720px] px-4 text-center sm:px-8">
          <h2 className="font-display text-[1.75rem] font-black italic leading-[1.12] text-white sm:text-[2.4rem]">
            {t("product.readyTitle")}
          </h2>
          <p className="mx-auto mt-5 max-w-[420px] text-[15px] leading-[1.7] text-white/60">
            {t("product.readySubtitle")}
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center sm:gap-5">
            <Link
              href={appUrl}
              className="inline-flex w-full justify-center rounded-lg bg-brand-blue px-8 py-3.5 text-[14px] font-semibold text-white shadow-md shadow-brand-blue/25 hover:bg-brand-blue-hover transition-colors sm:w-auto"
            >
              {t("product.ctaPrimary")}
            </Link>
            <Link
              href="/contact"
              className="inline-flex w-full justify-center rounded-lg border-2 border-white/20 px-8 py-3 text-[14px] font-semibold text-white hover:border-white/40 transition-colors sm:w-auto"
            >
              {t("product.ctaSecondary")}
            </Link>
          </div>
          <p className="mt-4 text-[12px] text-white/40">
            {t("product.readyNoCreditCard")}
          </p>
        </div>
      </section>
    </main>
  );
}
