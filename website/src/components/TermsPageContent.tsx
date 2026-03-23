"use client";

import { useTranslation } from "react-i18next";

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <>
      <h2 className="mt-12 mb-4 font-display text-xl font-bold italic text-[#141413]">{title}</h2>
      {children}
    </>
  );
}

function P({ children }: { children: React.ReactNode }) {
  return <p className="text-[15px] leading-[1.7] text-[#4a4a48] mb-6">{children}</p>;
}

export default function TermsPageContent() {
  const { t } = useTranslation();
  const bn = process.env.NEXT_PUBLIC_BUSINESS_NAME || "Spondic";

  return (
    <main className="min-h-[60vh]">
      <section className="border-b border-[#d8d4cb] bg-[#f7f5f0] py-20 lg:py-28">
        <div className="mx-auto max-w-[720px] px-8 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c49a3c]">{t("terms.label")}</p>
          <h1 className="mt-4 font-display text-[2.8rem] font-black italic leading-[1.08] sm:text-[3.2rem]">
            {t("terms.title")}
          </h1>
          <p className="mt-6 text-[15px] leading-[1.7] text-[#4a4a48]">
            {t("terms.lastUpdated", { date: "March 23, 2026" })}
          </p>
        </div>
      </section>

      <section className="py-16 lg:py-24">
        <div className="mx-auto max-w-[720px] px-8 prose prose-[#141413]">
          <P>{t("terms.intro", { businessName: bn })}</P>

          <Section title={t("terms.acceptanceTitle")}>
            <P>{t("terms.acceptanceDesc")}</P>
          </Section>

          <Section title={t("terms.accountTitle")}>
            <P>{t("terms.accountDesc")}</P>
          </Section>

          <Section title={t("terms.serviceDescTitle")}>
            <P>{t("terms.serviceDescDesc", { businessName: bn })}</P>
          </Section>

          <Section title={t("terms.aiUsageTitle")}>
            <P>{t("terms.aiUsageDesc")}</P>
            <ul className="list-disc pl-6 space-y-2 text-[15px] leading-[1.7] text-[#4a4a48] mb-6">
              <li>{t("terms.ai1")}</li>
              <li>{t("terms.ai2", { businessName: bn })}</li>
              <li>{t("terms.ai3")}</li>
              <li>{t("terms.ai4")}</li>
            </ul>
          </Section>

          <Section title={t("terms.dataOwnershipTitle")}>
            <P>{t("terms.dataOwnershipDesc")}</P>
          </Section>

          <Section title={t("terms.licenseTitle")}>
            <P>{t("terms.licenseDesc")}</P>
          </Section>

          <Section title={t("terms.prohibitedTitle")}>
            <P>{t("terms.prohibitedDesc")}</P>
            <ul className="list-disc pl-6 space-y-2 text-[15px] leading-[1.7] text-[#4a4a48] mb-6">
              <li>{t("terms.prohibited1")}</li>
              <li>{t("terms.prohibited2")}</li>
              <li>{t("terms.prohibited3")}</li>
              <li>{t("terms.prohibited4")}</li>
              <li>{t("terms.prohibited5")}</li>
              <li>{t("terms.prohibited6")}</li>
              <li>{t("terms.prohibited7")}</li>
            </ul>
          </Section>

          <Section title={t("terms.billingTitle")}>
            <P>{t("terms.billingDesc")}</P>
          </Section>

          <Section title={t("terms.slaTitle")}>
            <P>{t("terms.slaDesc")}</P>
            <h3 className="mt-8 mb-3 font-display text-lg font-bold text-[#141413]">{t("terms.uptimeTitle")}</h3>
            <P>{t("terms.uptimeDesc", { businessName: bn })}</P>
            <h3 className="mt-8 mb-3 font-display text-lg font-bold text-[#141413]">{t("terms.responseTitle")}</h3>
            <P>{t("terms.responseDesc")}</P>
            <ul className="list-disc pl-6 space-y-2 text-[15px] leading-[1.7] text-[#4a4a48] mb-6">
              <li><strong>{t("terms.p1")}</strong> — {t("terms.p1Desc")}</li>
              <li><strong>{t("terms.p2")}</strong> — {t("terms.p2Desc")}</li>
              <li><strong>{t("terms.p3")}</strong> — {t("terms.p3Desc")}</li>
            </ul>
            <h3 className="mt-8 mb-3 font-display text-lg font-bold text-[#141413]">{t("terms.supportTitle")}</h3>
            <P>{t("terms.supportDesc")}</P>
          </Section>

          <Section title={t("terms.confidentialityTitle")}>
            <P>{t("terms.confidentialityDesc")}</P>
          </Section>

          <Section title={t("terms.liabilityTitle")}>
            <p className="text-[15px] leading-[1.7] text-[#4a4a48] mb-6 uppercase text-[13px]">
              {t("terms.liabilityDesc", { businessName: bn })}
            </p>
          </Section>

          <Section title={t("terms.indemnityTitle")}>
            <P>{t("terms.indemnityDesc", { businessName: bn })}</P>
          </Section>

          <Section title={t("terms.terminationTitle")}>
            <P>{t("terms.terminationDesc")}</P>
          </Section>

          <Section title={t("terms.governingLawTitle")}>
            <P>{t("terms.governingLawDesc")}</P>
          </Section>

          <Section title={t("terms.generalTitle")}>
            <P>{t("terms.generalDesc", { businessName: bn })}</P>
          </Section>

          <Section title={t("terms.contactTitle")}>
            <P>{t("terms.contactDesc")}</P>
          </Section>
        </div>
      </section>
    </main>
  );
}
