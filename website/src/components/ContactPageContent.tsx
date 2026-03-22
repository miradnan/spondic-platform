"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";
import ContactForm from "./ContactForm";

export default function ContactPageContent() {
  const { t } = useTranslation();
  const businessName = process.env.NEXT_PUBLIC_BUSINESS_NAME || "Spondic";

  return (
    <main className="min-h-[60vh]">
      <section className="border-b border-[#d8d4cb] bg-[#f7f5f0] py-12 sm:py-20 lg:py-28">
        <div className="mx-auto max-w-[720px] px-4 text-center sm:px-8">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-gold">{t("contact.label")}</p>
          <h1 className="mt-4 font-display text-[2rem] font-black italic leading-[1.08] sm:text-[2.8rem] lg:text-[3.2rem]">
            {t("contact.title")}
          </h1>
          <p className="mt-6 text-[15px] leading-[1.7] text-body">
            {t("contact.subtitle", { businessName })}
          </p>
        </div>
      </section>

      <section className="py-12 sm:py-16 lg:py-24">
        <div className="mx-auto max-w-[960px] px-4 sm:px-8">
          <div className="grid gap-10 lg:grid-cols-2">
            {/* Contact Form */}
            <div className="rounded-2xl border border-[#d8d4cb] bg-white p-5 shadow-sm sm:p-8">
              <ContactForm />
            </div>

            {/* Demo & Quick Info */}
            <div className="space-y-6">
              {/* Book a Demo Card */}
              <div className="rounded-2xl bg-navy px-7 py-8 text-white">
                <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-gold">
                  {t("contact.liveWalkthrough")}
                </p>
                <h3 className="mt-3 font-display text-[1.5rem] font-bold italic leading-tight">
                  {t("contact.bookDemo")}
                </h3>
                <p className="mt-3 text-[14px] leading-[1.7] text-white/60">
                  {t("contact.bookDemoDesc", { businessName })}
                </p>
                <Link
                  href="mailto:hello@spondic.com?subject=Demo%20Request"
                  className="mt-6 inline-flex rounded-lg bg-brand-blue px-6 py-3 text-[13px] font-semibold text-white hover:bg-brand-blue-hover transition-colors"
                >
                  {t("contact.scheduleDemo")}
                </Link>
              </div>

              {/* Quick contact info */}
              <div className="rounded-2xl border border-[#d8d4cb] bg-white px-7 py-6">
                <h3 className="text-[14px] font-bold text-[#141413]">{t("contact.quickAnswers")}</h3>
                <div className="mt-4 space-y-4">
                  <div className="flex items-start gap-3">
                    <svg className="mt-0.5 h-5 w-5 shrink-0 text-brand-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M12 6v6h4.5m4.5 0a9 9 0 11-18 0 9 9 0 0118 0z" />
                    </svg>
                    <div>
                      <p className="text-[13px] font-semibold text-[#141413]">{t("contact.responseTime")}</p>
                      <p className="text-[13px] text-muted">{t("contact.responseTimeDesc")}</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <svg className="mt-0.5 h-5 w-5 shrink-0 text-brand-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M21.75 6.75v10.5a2.25 2.25 0 01-2.25 2.25h-15a2.25 2.25 0 01-2.25-2.25V6.75m19.5 0A2.25 2.25 0 0019.5 4.5h-15a2.25 2.25 0 00-2.25 2.25m19.5 0v.243a2.25 2.25 0 01-1.07 1.916l-7.5 4.615a2.25 2.25 0 01-2.36 0L3.32 8.91a2.25 2.25 0 01-1.07-1.916V6.75" />
                    </svg>
                    <div>
                      <p className="text-[13px] font-semibold text-[#141413]">{t("contact.emailUs")}</p>
                      <p className="text-[13px] text-muted">hello@spondic.com</p>
                    </div>
                  </div>
                  <div className="flex items-start gap-3">
                    <svg className="mt-0.5 h-5 w-5 shrink-0 text-brand-blue" fill="none" viewBox="0 0 24 24" stroke="currentColor" strokeWidth={1.5}>
                      <path strokeLinecap="round" strokeLinejoin="round" d="M9 12.75L11.25 15 15 9.75m-3-7.036A11.959 11.959 0 013.598 6 11.99 11.99 0 003 9.749c0 5.592 3.824 10.29 9 11.623 5.176-1.332 9-6.03 9-11.622 0-1.31-.21-2.571-.598-3.751h-.152c-3.196 0-6.1-1.248-8.25-3.285z" />
                    </svg>
                    <div>
                      <p className="text-[13px] font-semibold text-[#141413]">{t("contact.enterpriseSecurity")}</p>
                      <p className="text-[13px] text-muted">{t("contact.enterpriseSecurityDesc")}</p>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>
    </main>
  );
}
