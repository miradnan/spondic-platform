"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import PricingToggle from "./PricingToggle";
import Testimonials from "./Testimonials";
import TrustBadges from "./TrustBadges";
import FaqSchema from "./FaqSchema";
import ScrollReveal from "./ScrollReveal";
import CountUp from "./CountUp";

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-gold">
      {children}
    </p>
  );
}

export default function HomePageContent() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.spondic.com";
  const businessName = process.env.NEXT_PUBLIC_BUSINESS_NAME || "Spondic";
  const trialPeriod = process.env.NEXT_PUBLIC_TRIAL_PERIOD ?? "30";
  const { t } = useTranslation();

  const faqItems = [
    { q: t("faq.q1"), a: t("faq.a1") },
    { q: t("faq.q2"), a: t("faq.a2") },
    { q: t("faq.q3"), a: t("faq.a3") },
    { q: t("faq.q4"), a: t("faq.a4") },
    { q: t("faq.q5"), a: t("faq.a5") },
    { q: t("faq.q6"), a: t("faq.a6") },
    { q: t("faq.q7"), a: t("faq.a7") },
    { q: t("faq.q8"), a: t("faq.a8") },
  ];

  return (
    <main>
      <FaqSchema faqs={faqItems} />

      {/* Hero */}
      <section className="relative overflow-hidden">
        <div className="relative z-10 mx-auto grid w-full max-w-[1200px] px-4 md:px-6 sm:px-8 lg:grid-cols-2">
          {/* Left content */}
          <div className="relative z-10 pb-14 pt-8 sm:pb-16 sm:pt-10 lg:pb-24 lg:pt-16 lg:pr-16">
            <span className="hero-fade-in inline-flex items-center gap-1.5 rounded-full border border-[#141413]/15 bg-white/60 px-4 py-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#141413]/80 shadow-sm sm:mb-8 sm:py-2.5">
              <svg className="h-3.5 w-3.5 text-brand-gold" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              {t("hero.trusted")}
            </span>

            <h1 className="hero-fade-in hero-delay-1 mt-6 max-w-[520px] font-display text-[2.5rem] font-black italic leading-[1.08] tracking-tight sm:mt-8 sm:text-[3rem] sm:leading-tight lg:mt-0 lg:text-[4.2rem]">
              {t("hero.title")}{" "}
              <span className="hero-highlight">{t("hero.titleHighlight")}</span>
            </h1>

            <p className="hero-fade-in hero-delay-2 mt-6 max-w-[420px] text-[15px] leading-[1.75] text-body sm:mt-7">
              {t("hero.subtitle", { businessName })}
            </p>

            <div className="hero-fade-in hero-delay-3 mt-8 flex flex-col gap-4 sm:mt-10 sm:flex-row sm:flex-wrap sm:items-center sm:gap-5">
              <Link
                href={appUrl}
                className="hero-cta-pulse inline-flex w-full justify-center rounded-lg bg-brand-blue px-6 py-3.5 text-[14px] font-semibold text-white shadow-md shadow-brand-blue/25 hover:bg-brand-blue-hover transition-colors sm:w-auto sm:py-3"
              >
                {t("hero.cta")}
              </Link>
              <Link
                href="/contact"
                className="inline-flex w-full justify-center rounded-lg border-2 border-[#141413]/15 px-6 py-3 text-[14px] font-semibold text-[#141413] hover:border-brand-blue hover:text-brand-blue transition-colors sm:w-auto"
              >
                {t("hero.secondaryCta")}
              </Link>
              <a
                href="#how-it-works"
                className="hidden text-[13px] font-medium text-muted hover:text-brand-blue transition-colors sm:inline-block"
              >
                {t("hero.seeHow")} &darr;
              </a>
            </div>
            <p className="hero-fade-in hero-delay-3 mt-3 flex items-center gap-1.5 text-[12px] text-muted">
              <svg className="h-3.5 w-3.5 text-green-600" fill="currentColor" viewBox="0 0 20 20">
                <path fillRule="evenodd" d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z" clipRule="evenodd" />
              </svg>
              {t("hero.noCreditCard")} &middot; {t("hero.freeTrial", { days: trialPeriod })}
            </p>

            {/* Stats */}
            <div className="hero-fade-in hero-delay-4 mt-10 grid grid-cols-1 sm:grid-cols-3 gap-4 rounded-xl border border-[#d8d4cb]/60 bg-white/50 px-4 py-5 sm:mt-14 sm:flex sm:flex-wrap sm:gap-12 sm:rounded-none sm:border-0 sm:bg-transparent sm:px-0 sm:py-0">
              <div className="text-center sm:text-left">
                <p className="font-display text-[1.75rem] font-black italic leading-none text-[#141413] sm:text-[2.2rem]">
                  <CountUp end={90} suffix="%" />
                </p>
                <p className="mt-1 text-[10px] leading-tight text-muted sm:mt-1.5 sm:text-[11px]">
                  {t("hero.stat1")}
                </p>
              </div>
              <div className="text-center sm:text-left">
                <p className="font-display text-[1.75rem] font-black italic leading-none text-[#141413] sm:text-[2.2rem]">
                  <CountUp end={40} suffix="hrs" />
                </p>
                <p className="mt-1 text-[10px] leading-tight text-muted sm:mt-1.5 sm:text-[11px]">
                  {t("hero.stat2")}
                </p>
              </div>
              <div className="text-center sm:text-left">
                <p className="font-display text-[1.75rem] font-black italic leading-none text-[#141413] sm:text-[2.2rem]">
                  <CountUp end={3} suffix="x" />
                </p>
                <p className="mt-1 text-[10px] leading-tight text-muted sm:mt-1.5 sm:text-[11px]">
                  {t("hero.stat3")}
                </p>
              </div>
            </div>
            <p className="hero-fade-in hero-delay-4 mt-3 text-[10px] text-muted/70 sm:mt-4">
              {t("hero.statFootnote")}
            </p>
          </div>

          {/* Right — desktop mockup */}
          <div className="relative z-10 hidden items-center justify-center py-12 lg:flex">
            <div className="hero-backdrop" />
            <div className="hero-mockup relative w-full max-w-[380px] rounded-xl bg-white shadow-2xl">
              <div className="flex items-center gap-2 rounded-t-xl bg-navy-light px-4 py-3">
                <span className="h-2.5 w-2.5 rounded-full bg-[#ff5f57]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#febc2e]" />
                <span className="h-2.5 w-2.5 rounded-full bg-[#28c840]" />
                <span className="ml-3 text-[11px] font-medium text-white/80">
                  {businessName} AI — Generating answers...
                </span>
              </div>
              <div className="p-5">
                <div className="flex items-center justify-between">
                  <p className="text-[9px] font-bold uppercase tracking-[0.15em] text-muted">Question 42 of 180</p>
                  <span className="rounded-full bg-green-100 px-2.5 py-0.5 text-[9px] font-semibold text-green-700">AI Drafted</span>
                </div>
                <p className="mt-2.5 text-[12px] leading-relaxed text-body">
                  Describe your data security and compliance certifications including ISO 27001 and GDPR posture.
                </p>
                <div className="mt-4 rounded-lg border border-gray-200 bg-[#f8f8f6] p-3.5">
                  <p className="text-[11px] leading-[1.7] text-body">
                    Our platform is ISO 27001 compliant. All data is encrypted at rest and in transit using AES-256. We maintain full GDPR compliance with dedicated DPO oversight and data residency options across India, EU, and US regions...
                  </p>
                </div>
                <p className="mt-3 text-[10px] text-brand-gold">
                  &#10022; Sourced from: Security-RFP-Accenture-2024.pdf
                </p>
                <div className="mt-4 flex items-center gap-3">
                  <div className="h-1.5 flex-1 rounded-full bg-gray-200">
                    <div className="hero-progress h-1.5 rounded-full bg-brand-blue" />
                  </div>
                  <span className="text-[9px] text-muted">68 of 180 answered</span>
                </div>
                <div className="mt-4 flex gap-2">
                  <button className="flex-1 rounded-md bg-brand-blue px-3 py-1.5 text-[10px] font-semibold text-white">Approve</button>
                  <button className="flex-1 rounded-md border border-[#d8d4cb] px-3 py-1.5 text-[10px] font-semibold text-body">Edit</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        {/* Mobile mockup */}
        <div className="relative z-10 mx-auto w-full max-w-[340px] px-4 pb-10 sm:max-w-[400px] lg:hidden">
          <div className="rounded-xl border border-[#d8d4cb] bg-white shadow-lg">
            <div className="flex items-center gap-2 rounded-t-xl bg-navy-light px-3.5 py-2.5">
              <span className="h-2 w-2 rounded-full bg-[#ff5f57]" />
              <span className="h-2 w-2 rounded-full bg-[#febc2e]" />
              <span className="h-2 w-2 rounded-full bg-[#28c840]" />
              <span className="ml-2 text-[10px] font-medium text-white/70">{businessName} AI</span>
            </div>
            <div className="p-4">
              <div className="flex items-center justify-between">
                <p className="text-[9px] font-bold uppercase tracking-[0.12em] text-muted">Q42 of 180</p>
                <span className="rounded-full bg-green-100 px-2 py-0.5 text-[8px] font-semibold text-green-700">AI Drafted</span>
              </div>
              <p className="mt-2 text-[11px] leading-relaxed text-body">
                Describe your data security and compliance certifications.
              </p>
              <div className="mt-3 rounded-md border border-gray-200 bg-[#f8f8f6] p-3">
                <p className="text-[10px] leading-[1.65] text-body">
                  Our platform is ISO 27001 compliant. All data is encrypted using AES-256...
                </p>
              </div>
              <p className="mt-2 text-[9px] text-brand-gold">&#10022; Security-RFP-Accenture-2024.pdf</p>
              <div className="mt-3 flex items-center gap-2">
                <div className="h-1 flex-1 rounded-full bg-gray-200">
                  <div className="h-1 w-[38%] rounded-full bg-brand-blue" />
                </div>
                <span className="text-[8px] text-muted">68/180</span>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Trust & Security */}
      <section className="relative overflow-hidden bg-navy py-14 sm:py-20 lg:py-24">
        <div className="pointer-events-none absolute inset-0">
          <div className="absolute -left-32 -top-32 h-96 w-96 rounded-full bg-brand-gold/[0.04] blur-3xl" />
          <div className="absolute -bottom-32 -right-32 h-96 w-96 rounded-full bg-brand-blue/[0.06] blur-3xl" />
        </div>
        <div className="relative mx-auto max-w-[1200px] px-4 sm:px-8">
          <div className="flex flex-col items-center text-center">
            <ScrollReveal>
              <div className="mx-auto flex h-14 w-14 items-center justify-center rounded-2xl bg-brand-gold/15">
                <svg className="h-7 w-7 text-brand-gold" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                  <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                </svg>
              </div>
              <p className="mt-4 text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-gold">
                {t("security.label")}
              </p>
              <h2 className="mt-3 font-display text-[1.6rem] font-black italic leading-tight text-white sm:text-[2.2rem]">
                {t("security.title")}
              </h2>
              <p className="mt-4 max-w-[520px] text-[15px] leading-[1.7] text-white/60">
                {t("security.subtitle", { businessName })}
              </p>
            </ScrollReveal>
          </div>
          <div className="mt-12">
            <TrustBadges />
          </div>
          <div className="mt-10 flex flex-wrap items-center justify-center gap-2 sm:gap-3">
            <span className="text-[11px] font-medium text-white/40">{t("security.trustedAcross")}</span>
            {[
              t("security.manufacturing"),
              t("security.bfsi"),
              t("security.healthcare"),
              t("security.logistics"),
              t("security.infrastructure"),
            ].map((v) => (
              <span key={v} className="rounded-full border border-white/10 bg-white/[0.05] px-3.5 py-1 text-[11px] font-medium text-white/50">
                {v}
              </span>
            ))}
          </div>
        </div>
      </section>

      {/* The Problem */}
      <section className="py-12 sm:py-20 lg:py-28">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-8">
          <ScrollReveal>
            <SectionLabel>{t("problem.label")}</SectionLabel>
            <h2 className="mt-4 max-w-[500px] font-display text-[2rem] font-black italic leading-[1.08] sm:text-[2.8rem] lg:text-[3.2rem]">
              {t("problem.title")}
            </h2>
            <p className="mt-5 max-w-[380px] text-[15px] leading-[1.7] text-body">
              {t("problem.subtitle")}
            </p>
          </ScrollReveal>

          <div className="mt-16 grid gap-6 sm:grid-cols-3">
            {[
              { stat: 40, suffix: "", prefix: "", title: t("problem.stat1Title"), desc: t("problem.stat1Desc") },
              { stat: 500, suffix: "", prefix: "", title: t("problem.stat2Title"), desc: t("problem.stat2Desc") },
              { stat: 30, suffix: "K+", prefix: "$", title: t("problem.stat3Title"), desc: t("problem.stat3Desc") },
            ].map((c, i) => (
              <ScrollReveal key={c.title} delay={i * 100}>
                <div className="rounded-2xl border border-[#d8d4cb] bg-white px-7 py-8">
                  <p className="font-display text-[3.5rem] font-bold italic leading-none text-brand-gold/60">
                    <CountUp end={c.stat} suffix={c.suffix} prefix={c.prefix} />
                  </p>
                  <h3 className="mt-4 text-[14px] font-bold text-[#141413]">{c.title}</h3>
                  <p className="mt-2 text-[13px] leading-[1.7] text-body">{c.desc}</p>
                </div>
              </ScrollReveal>
            ))}
          </div>
        </div>
      </section>

      {/* How It Works */}
      <section id="how-it-works" className="bg-navy">
        <div className="mx-auto max-w-[1200px] px-4 pt-12 sm:px-8 sm:pt-20 lg:pt-28">
          <ScrollReveal>
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-gold">
              {t("howItWorks.label")}
            </p>
            <h2 className="mt-4 max-w-[500px] font-display text-[2rem] font-black italic leading-[1.08] text-white sm:text-[2.8rem] lg:text-[3.2rem]">
              {t("howItWorks.title")}
            </h2>
            <p className="mt-5 max-w-[380px] text-[15px] leading-[1.7] text-white/60">
              {t("howItWorks.subtitle")}
            </p>
          </ScrollReveal>
        </div>

        <div className="pb-16 pt-10 sm:pb-24 sm:pt-16">
          <div className="mx-auto max-w-[1200px] px-4 sm:px-8">
            <div className="relative grid grid-cols-1 gap-8 sm:grid-cols-2 lg:grid-cols-5 lg:gap-6">
              <div className="absolute left-[10%] right-[10%] top-[28px] hidden h-[2px] bg-white/15 lg:block" />

              {[
                {
                  n: 1,
                  title: t("howItWorks.step1Title"),
                  desc: t("howItWorks.step1Desc"),
                  icon: (
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M3 16.5v2.25A2.25 2.25 0 005.25 21h13.5A2.25 2.25 0 0021 18.75V16.5m-13.5-9L12 3m0 0l4.5 4.5M12 3v13.5" />
                    </svg>
                  ),
                },
                {
                  n: 2,
                  title: t("howItWorks.step2Title"),
                  desc: t("howItWorks.step2Desc"),
                  icon: (
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M20.25 6.375c0 2.278-3.694 4.125-8.25 4.125S3.75 8.653 3.75 6.375m16.5 0c0-2.278-3.694-4.125-8.25-4.125S3.75 4.097 3.75 6.375m16.5 0v11.25c0 2.278-3.694 4.125-8.25 4.125s-8.25-1.847-8.25-4.125V6.375" />
                    </svg>
                  ),
                },
                {
                  n: 3,
                  title: t("howItWorks.step3Title"),
                  desc: t("howItWorks.step3Desc"),
                  icon: (
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M19.5 14.25v-2.625a3.375 3.375 0 00-3.375-3.375h-1.5A1.125 1.125 0 0113.5 7.125v-1.5a3.375 3.375 0 00-3.375-3.375H8.25m2.25 0H5.625c-.621 0-1.125.504-1.125 1.125v17.25c0 .621.504 1.125 1.125 1.125h12.75c.621 0 1.125-.504 1.125-1.125V11.25a9 9 0 00-9-9z" />
                    </svg>
                  ),
                },
                {
                  n: 4,
                  title: t("howItWorks.step4Title"),
                  desc: t("howItWorks.step4Desc"),
                  icon: (
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9.813 15.904L9 18.75l-.813-2.846a4.5 4.5 0 00-3.09-3.09L2.25 12l2.846-.813a4.5 4.5 0 003.09-3.09L9 5.25l.813 2.846a4.5 4.5 0 003.09 3.09L15.75 12l-2.846.813a4.5 4.5 0 00-3.09 3.09zM18.259 8.715L18 9.75l-.259-1.035a3.375 3.375 0 00-2.455-2.456L14.25 6l1.036-.259a3.375 3.375 0 002.455-2.456L18 2.25l.259 1.035a3.375 3.375 0 002.455 2.456L21.75 6l-1.036.259a3.375 3.375 0 00-2.455 2.456z" />
                    </svg>
                  ),
                },
                {
                  n: 5,
                  title: t("howItWorks.step5Title"),
                  desc: t("howItWorks.step5Desc"),
                  icon: (
                    <svg className="h-6 w-6" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                  ),
                },
              ].map((step, i) => (
                <ScrollReveal key={step.n} delay={i * 80}>
                  <div className="relative flex items-start gap-4 text-left sm:flex-col sm:gap-0 sm:text-center lg:gap-0">
                    <span className="relative z-10 flex h-14 w-14 shrink-0 items-center justify-center rounded-full bg-brand-blue text-white shadow-lg shadow-brand-blue/30 sm:mx-auto">
                      {step.icon}
                    </span>
                    <div className="pt-1 sm:mt-6 sm:pt-0">
                      <h3 className="text-[15px] font-semibold text-white">{step.title}</h3>
                      <p className="mt-2.5 text-[13px] leading-[1.6] text-white/50">{step.desc}</p>
                    </div>
                  </div>
                </ScrollReveal>
              ))}
            </div>
          </div>
        </div>
      </section>

      {/* Testimonials */}
      <Testimonials />

      {/* Pricing */}
      <section id="pricing" className="border-t border-[#d8d4cb] bg-[#f7f5f0] py-12 sm:py-20 lg:py-28">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-8">
          <ScrollReveal>
            <SectionLabel>{t("pricing.label")}</SectionLabel>
            <h2 className="mt-4 max-w-[520px] font-display text-[2rem] font-black italic leading-[1.08] sm:text-[2.8rem] lg:text-[3.2rem]">
              {t("pricing.title")}
            </h2>
            <p className="mt-5 text-[15px] text-body">
              {t("pricing.subtitle", { days: trialPeriod })}
            </p>
          </ScrollReveal>

          <PricingToggle appUrl={appUrl} />

          <div className="mt-10 flex items-center justify-center gap-2 text-[13px] text-muted">
            <svg className="h-5 w-5 text-brand-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
              <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
            </svg>
            {t("pricing.guarantee")}
          </div>
        </div>
      </section>

      {/* Why Us */}
      <section className="py-12 sm:py-20 lg:py-28">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-8">
          <ScrollReveal>
            <SectionLabel>{t("whyUs.label", { businessName })}</SectionLabel>
            <h2 className="mt-4 max-w-[520px] font-display text-[2rem] font-black italic leading-[1.08] sm:text-[2.8rem] lg:text-[3.2rem]">
              {t("whyUs.title")}
            </h2>
            <p className="mt-5 max-w-[400px] text-[15px] leading-[1.7] text-body">
              {t("whyUs.subtitle")}
            </p>
          </ScrollReveal>

          <ScrollReveal delay={100}>
            <div className="relative mt-14 rounded-2xl border border-[#d8d4cb] bg-cream-light">
              {/* Mobile scroll hint */}
              <div className="pointer-events-none absolute inset-y-0 right-0 z-10 w-8 rounded-r-2xl bg-gradient-to-l from-[#f0ede6] to-transparent sm:hidden" />
              <p className="px-6 pt-3 text-[11px] text-muted sm:hidden">Scroll to see more &rarr;</p>
              <div className="overflow-x-auto">
              <table className="w-full text-[13px]">
                <thead>
                  <tr className="border-b border-[#d8d4cb] text-left">
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.18em] text-muted">{t("whyUs.colTool")}</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.18em] text-muted">{t("whyUs.colPrice")}</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.18em] text-muted">{t("whyUs.colMarket")}</th>
                    <th className="px-6 py-4 text-[10px] font-bold uppercase tracking-[0.18em] text-muted">{t("whyUs.colVerdict")}</th>
                  </tr>
                </thead>
                <tbody>
                  {[
                    { tool: "Loopio", price: "$30,000+", market: "Large Enterprise", verdict: t("whyUs.tooExpensive"), vClass: "text-red-600" },
                    { tool: "Responsive (RFPIO)", price: "$20,000+", market: "Enterprise", verdict: t("whyUs.tooComplex"), vClass: "text-red-600" },
                    { tool: "Ombud", price: "$15,000+", market: "Mid-Enterprise", verdict: t("whyUs.stillPricey"), vClass: "text-orange-500" },
                  ].map((row) => (
                    <tr key={row.tool} className="border-b border-[#d8d4cb]/50">
                      <td className="px-6 py-5 text-body">{row.tool}</td>
                      <td className="px-6 py-5 text-body">{row.price}</td>
                      <td className="px-6 py-5 text-body">{row.market}</td>
                      <td className={`px-6 py-5 font-medium ${row.vClass}`}>{row.verdict}</td>
                    </tr>
                  ))}
                  <tr className="border-l-4 border-brand-blue bg-[#e8eef7]">
                    <td className="px-6 py-5 font-semibold text-brand-blue">{businessName} &#10022;</td>
                    <td className="px-6 py-5 text-body">$3,600 &ndash; $9,600</td>
                    <td className="px-6 py-5 text-body">Mid-Market</td>
                    <td className="px-6 py-5">
                      <span className="inline-block rounded bg-brand-blue/15 px-3 py-1 text-[12px] font-semibold text-brand-blue">
                        {t("whyUs.bestValue")}
                      </span>
                    </td>
                  </tr>
                </tbody>
              </table>
              </div>
            </div>
          </ScrollReveal>
        </div>
      </section>

      {/* CTA Banner */}
      <section className="bg-navy py-12 sm:py-16 lg:py-20">
        <div className="mx-auto max-w-[720px] px-4 text-center sm:px-8">
          <h2 className="font-display text-[1.75rem] font-black italic leading-[1.12] text-white sm:text-[2.4rem]">
            {t("cta.title")}
          </h2>
          <p className="mx-auto mt-5 max-w-[420px] text-[15px] leading-[1.7] text-white/60">
            {t("cta.subtitle", { businessName })}
          </p>
          <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-center sm:gap-5">
            <Link
              href={appUrl}
              className="inline-flex w-full justify-center rounded-lg bg-brand-blue px-8 py-3.5 text-[14px] font-semibold text-white shadow-md shadow-brand-blue/25 hover:bg-brand-blue-hover transition-colors sm:w-auto"
            >
              {t("cta.primaryCta")}
            </Link>
            <Link
              href="/contact"
              className="inline-flex w-full justify-center rounded-lg border-2 border-white/20 px-8 py-3 text-[14px] font-semibold text-white hover:border-white/40 transition-colors sm:w-auto"
            >
              {t("cta.secondaryCta")}
            </Link>
          </div>
          <p className="mt-4 text-[12px] text-white/40">
            {t("cta.noCreditCard")} &middot; {t("cta.cancelAnytime")}
          </p>
        </div>
      </section>

      {/* FAQ */}
      <section id="faq" className="py-12 sm:py-20 lg:py-28">
        <div className="mx-auto max-w-[720px] px-4 sm:px-8">
          <ScrollReveal>
            <h2 className="font-display text-[2rem] font-black italic leading-[1.08] sm:text-[2.8rem]">
              {t("faq.title")}
            </h2>
          </ScrollReveal>

          <div className="mt-10 divide-y divide-[#d8d4cb]">
            {faqItems.map((item) => (
              <details key={item.q} className="group py-5">
                <summary className="flex cursor-pointer items-center gap-3 text-[15px] font-semibold text-[#141413] [&::-webkit-details-marker]:hidden list-none">
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-md bg-navy text-[12px] font-bold text-white">
                    Q
                  </span>
                  {item.q}
                  <svg
                    className="ml-auto h-4 w-4 shrink-0 text-muted transition-transform group-open:rotate-180"
                    fill="none"
                    viewBox="0 0 24 24"
                    stroke="currentColor"
                    strokeWidth={2}
                  >
                    <path strokeLinecap="round" strokeLinejoin="round" d="M19 9l-7 7-7-7" />
                  </svg>
                </summary>
                <p className="mt-3 pl-9 text-[14px] leading-[1.7] text-body">
                  {item.a}
                </p>
              </details>
            ))}
          </div>
        </div>
      </section>
    </main>
  );
}
