"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";

export default function PrivacyPageContent() {
  const { t } = useTranslation();
  const businessName = process.env.NEXT_PUBLIC_BUSINESS_NAME || "Spondic";

  return (
    <main className="min-h-[60vh]">
      <section className="border-b border-[#d8d4cb] bg-[#f7f5f0] py-20 lg:py-28">
        <div className="mx-auto max-w-[720px] px-8 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c49a3c]">{t("privacy.label")}</p>
          <h1 className="mt-4 font-display text-[2.8rem] font-black italic leading-[1.08] sm:text-[3.2rem]">
            {t("privacy.title")}
          </h1>
          <p className="mt-6 text-[15px] leading-[1.7] text-[#4a4a48]">
            {t("privacy.lastUpdated", { date: new Date().toLocaleDateString("en-US") })}
          </p>
        </div>
      </section>

      <section className="py-16 lg:py-24">
        <div className="mx-auto max-w-[720px] px-8 prose prose-[#141413]">
          <p className="text-[15px] leading-[1.7] text-[#4a4a48] mb-10">
            {t("privacy.intro", { businessName })}
          </p>

          <h2 className="mt-12 mb-4 font-display text-xl font-bold italic text-[#141413]">
            {t("privacy.infoWeCollectTitle")}
          </h2>
          <p className="text-[15px] leading-[1.7] text-[#4a4a48] mb-6">
            {t("privacy.infoWeCollectDesc")}
          </p>

          <h2 className="mt-12 mb-4 font-display text-xl font-bold italic text-[#141413]">
            {t("privacy.trackingTitle")}
          </h2>
          <p className="text-[15px] leading-[1.7] text-[#4a4a48] mb-6">
            {t("privacy.trackingDesc")}
          </p>

          <h2 className="mt-12 mb-4 font-display text-xl font-bold italic text-[#141413]">
            {t("privacy.analyticsTitle")}
          </h2>
          <p className="text-[15px] leading-[1.7] text-[#4a4a48] mb-4">
            {t("privacy.analyticsDesc")}
          </p>
          <p className="text-[15px] leading-[1.7] text-[#4a4a48] mb-2">
            {t("privacy.analyticsDataIntro")}
          </p>
          <ul className="list-disc pl-6 space-y-2 text-[15px] leading-[1.7] text-[#4a4a48] mb-4">
            <li>{t("privacy.analyticsData1")}</li>
            <li>{t("privacy.analyticsData2")}</li>
            <li>{t("privacy.analyticsData3")}</li>
            <li>{t("privacy.analyticsData4")}</li>
          </ul>
          <p className="text-[15px] leading-[1.7] text-[#4a4a48] mb-6">
            {t("privacy.analyticsTransmit")}{" "}
            <a href="https://policies.google.com/privacy" target="_blank" rel="noopener noreferrer" className="text-[#2d5fa0] hover:underline">
              https://policies.google.com/privacy
            </a>
          </p>

          <h2 className="mt-12 mb-4 font-display text-xl font-bold italic text-[#141413]">
            {t("privacy.thirdPartyTitle")}
          </h2>
          <p className="text-[15px] leading-[1.7] text-[#4a4a48] mb-4">
            {t("privacy.thirdPartyDesc", { businessName })}
          </p>
          <ul className="list-disc pl-6 space-y-2 text-[15px] leading-[1.7] text-[#4a4a48] mb-6">
            <li>{t("privacy.thirdParty1")}</li>
            <li>{t("privacy.thirdParty2")}</li>
            <li>{t("privacy.thirdParty3")}</li>
          </ul>
          <p className="text-[15px] leading-[1.7] text-[#4a4a48] mb-6">
            {t("privacy.thirdPartyMore")}
          </p>

          <h2 className="mt-12 mb-4 font-display text-xl font-bold italic text-[#141413]">
            {t("privacy.howWeUseTitle")}
          </h2>
          <p className="text-[15px] leading-[1.7] text-[#4a4a48] mb-6">
            {t("privacy.howWeUseDesc")}
          </p>

          <h2 className="mt-12 mb-4 font-display text-xl font-bold italic text-[#141413]">
            {t("privacy.dataSecurityTitle")}
          </h2>
          <p className="text-[15px] leading-[1.7] text-[#4a4a48] mb-6">
            {t("privacy.dataSecurityDesc")}
          </p>

          <h2 className="mt-12 mb-4 font-display text-xl font-bold italic text-[#141413]">
            {t("privacy.changesTitle")}
          </h2>
          <p className="text-[15px] leading-[1.7] text-[#4a4a48] mb-6">
            {t("privacy.changesDesc")}
          </p>

          <h2 className="mt-12 mb-4 font-display text-xl font-bold italic text-[#141413]">
            {t("privacy.contactTitle")}
          </h2>
          <p className="text-[15px] leading-[1.7] text-[#4a4a48] mb-6">
            {t("privacy.contactDesc")} <Link href="/contact" className="text-[#2d5fa0] hover:underline">{t("privacy.contactPage")}</Link>.
          </p>
        </div>
      </section>
    </main>
  );
}
