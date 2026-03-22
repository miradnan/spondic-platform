"use client";

import { useTranslation } from "react-i18next";

export default function TermsPageContent() {
  const { t } = useTranslation();
  const businessName = process.env.NEXT_PUBLIC_BUSINESS_NAME || "Spondic";

  return (
    <main className="min-h-[60vh]">
      <section className="border-b border-[#d8d4cb] bg-[#f7f5f0] py-20 lg:py-28">
        <div className="mx-auto max-w-[720px] px-8 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c49a3c]">{t("terms.label")}</p>
          <h1 className="mt-4 font-display text-[2.8rem] font-black italic leading-[1.08] sm:text-[3.2rem]">
            {t("terms.title")}
          </h1>
          <p className="mt-6 text-[15px] leading-[1.7] text-[#4a4a48]">
            {t("terms.lastUpdated", { date: new Date().toLocaleDateString("en-US") })}
          </p>
        </div>
      </section>

      <section className="py-16 lg:py-24">
        <div className="mx-auto max-w-[720px] px-8 prose prose-[#141413]">
          <p className="text-[15px] leading-[1.7] text-[#4a4a48] mb-10">
            {t("terms.intro", { businessName })}
          </p>

          <h2 className="mt-12 mb-4 font-display text-xl font-bold italic text-[#141413]">
            {t("terms.slaTitle")}
          </h2>
          <p className="text-[15px] leading-[1.7] text-[#4a4a48] mb-6">
            {t("terms.slaDesc", { businessName })}
          </p>

          <h3 className="mt-8 mb-3 font-display text-lg font-bold text-[#141413]">{t("terms.uptimeTitle")}</h3>
          <p className="text-[15px] leading-[1.7] text-[#4a4a48] mb-6">
            {t("terms.uptimeDesc", { businessName })}
          </p>

          <h3 className="mt-8 mb-3 font-display text-lg font-bold text-[#141413]">{t("terms.responseTitle")}</h3>
          <p className="text-[15px] leading-[1.7] text-[#4a4a48] mb-4">
            {t("terms.responseDesc")}
          </p>
          <ul className="list-disc pl-6 space-y-2 text-[15px] leading-[1.7] text-[#4a4a48] mb-6">
            <li><strong>{t("terms.p1")}</strong> — {t("terms.p1Desc")}</li>
            <li><strong>{t("terms.p2")}</strong> — {t("terms.p2Desc")}</li>
            <li><strong>{t("terms.p3")}</strong> — {t("terms.p3Desc")}</li>
          </ul>

          <h3 className="mt-8 mb-3 font-display text-lg font-bold text-[#141413]">{t("terms.supportTitle")}</h3>
          <p className="text-[15px] leading-[1.7] text-[#4a4a48] mb-6">
            {t("terms.supportDesc")}
          </p>

          <h2 className="mt-12 mb-4 font-display text-xl font-bold italic text-[#141413]">
            {t("terms.generalTitle")}
          </h2>
          <p className="text-[15px] leading-[1.7] text-[#4a4a48] mb-6">
            {t("terms.generalDesc")}
          </p>
        </div>
      </section>
    </main>
  );
}
