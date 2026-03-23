"use client";

import Link from "next/link";
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

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="list-disc pl-6 space-y-2 text-[15px] leading-[1.7] text-[#4a4a48] mb-6">
      {items.map((item, i) => (
        <li key={i}>{item}</li>
      ))}
    </ul>
  );
}

export default function PrivacyPageContent() {
  const { t } = useTranslation();
  const bn = process.env.NEXT_PUBLIC_BUSINESS_NAME || "Spondic";

  return (
    <main className="min-h-[60vh]">
      <section className="border-b border-[#d8d4cb] bg-[#f7f5f0] py-20 lg:py-28">
        <div className="mx-auto max-w-[720px] px-8 text-center">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-[#c49a3c]">{t("privacy.label")}</p>
          <h1 className="mt-4 font-display text-[2.8rem] font-black italic leading-[1.08] sm:text-[3.2rem]">
            {t("privacy.title")}
          </h1>
          <p className="mt-6 text-[15px] leading-[1.7] text-[#4a4a48]">
            {t("privacy.lastUpdated", { date: "March 23, 2026" })}
          </p>
        </div>
      </section>

      <section className="py-16 lg:py-24">
        <div className="mx-auto max-w-[720px] px-8 prose prose-[#141413]">
          <P>{t("privacy.intro", { businessName: bn })}</P>

          <Section title={t("privacy.infoWeCollectTitle")}>
            <P>{t("privacy.infoWeCollectDesc")}</P>
            <BulletList items={[
              t("privacy.infoAccount"),
              t("privacy.infoContent"),
              t("privacy.infoUsage"),
              t("privacy.infoDevice"),
              t("privacy.infoBilling"),
            ]} />
          </Section>

          <Section title={t("privacy.trackingTitle")}>
            <P>{t("privacy.trackingDesc")}</P>
          </Section>

          <Section title={t("privacy.analyticsTitle")}>
            <P>{t("privacy.analyticsDesc")}</P>
          </Section>

          <Section title={t("privacy.aiTitle")}>
            <P>{t("privacy.aiDesc")}</P>
            <BulletList items={[
              t("privacy.ai1"),
              t("privacy.ai2"),
              t("privacy.ai3"),
              t("privacy.ai4"),
            ]} />
          </Section>

          <Section title={t("privacy.thirdPartyTitle")}>
            <P>{t("privacy.thirdPartyDesc")}</P>
            <BulletList items={[
              t("privacy.thirdParty1"),
              t("privacy.thirdParty2"),
              t("privacy.thirdParty3"),
              t("privacy.thirdParty4"),
            ]} />
            <P>{t("privacy.thirdPartyMore")}</P>
          </Section>

          <Section title={t("privacy.howWeUseTitle")}>
            <P>{t("privacy.howWeUseDesc")}</P>
          </Section>

          <Section title={t("privacy.dataRetentionTitle")}>
            <P>{t("privacy.dataRetentionDesc")}</P>
          </Section>

          <Section title={t("privacy.dataSecurityTitle")}>
            <P>{t("privacy.dataSecurityDesc")}</P>
          </Section>

          <Section title={t("privacy.dataResidencyTitle")}>
            <P>{t("privacy.dataResidencyDesc")}</P>
          </Section>

          <Section title={t("privacy.yourRightsTitle")}>
            <P>{t("privacy.yourRightsDesc")}</P>
            <BulletList items={[
              t("privacy.right1"),
              t("privacy.right2"),
              t("privacy.right3"),
              t("privacy.right4"),
              t("privacy.right5"),
              t("privacy.right6"),
            ]} />
            <P>{t("privacy.yourRightsHow")}</P>
          </Section>

          <Section title={t("privacy.gdprTitle")}>
            <P>{t("privacy.gdprDesc")}</P>
          </Section>

          <Section title={t("privacy.ccpaTitle")}>
            <P>{t("privacy.ccpaDesc")}</P>
          </Section>

          <Section title={t("privacy.changesTitle")}>
            <P>{t("privacy.changesDesc")}</P>
          </Section>

          <Section title={t("privacy.contactTitle")}>
            <P>
              {t("privacy.contactDesc")}{" "}
              <Link href="/contact" className="text-[#2d5fa0] hover:underline">{t("privacy.contactPage")}</Link>.
            </P>
            <P>{t("privacy.contactExtra")}</P>
          </Section>
        </div>
      </section>
    </main>
  );
}
