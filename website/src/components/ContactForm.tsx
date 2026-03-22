"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";

export default function ContactForm() {
  const [submitted, setSubmitted] = useState(false);
  const { t } = useTranslation();
  const businessName = process.env.NEXT_PUBLIC_BUSINESS_NAME || "Spondic";

  function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitted(true);
  }

  return (
    <>
      <h2 className="font-display text-[1.35rem] font-bold italic text-[#141413]">{t("contact.getInTouch")}</h2>

      {submitted ? (
        <div className="mt-6 rounded-lg bg-[#e8eef7] px-4 py-5 text-[14px] text-body">
          <p className="font-semibold text-brand-blue">{t("contact.thankYou")}</p>
          <p className="mt-2">{t("contact.weWillReply")}</p>
        </div>
      ) : (
        <form onSubmit={handleSubmit} className="mt-6 space-y-5">
          <div>
            <label htmlFor="fullName" className="mb-1.5 block text-[13px] font-medium text-[#141413]">
              {t("contact.fullName")}
            </label>
            <input
              id="fullName"
              name="fullName"
              type="text"
              required
              className="w-full rounded-lg border border-[#d8d4cb] px-4 py-2.5 text-[14px] text-[#141413] placeholder:text-muted focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
              placeholder="Jane Smith"
            />
          </div>
          <div>
            <label htmlFor="email" className="mb-1.5 block text-[13px] font-medium text-[#141413]">
              {t("contact.email")}
            </label>
            <input
              id="email"
              name="email"
              type="email"
              required
              className="w-full rounded-lg border border-[#d8d4cb] px-4 py-2.5 text-[14px] text-[#141413] placeholder:text-muted focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
              placeholder="jane@company.com"
            />
          </div>
          <div>
            <label htmlFor="organization" className="mb-1.5 block text-[13px] font-medium text-[#141413]">
              {t("contact.organization")}
            </label>
            <input
              id="organization"
              name="organization"
              type="text"
              className="w-full rounded-lg border border-[#d8d4cb] px-4 py-2.5 text-[14px] text-[#141413] placeholder:text-muted focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
              placeholder="Acme Inc."
            />
          </div>
          <div>
            <label htmlFor="message" className="mb-1.5 block text-[13px] font-medium text-[#141413]">
              {t("contact.message")}
            </label>
            <textarea
              id="message"
              name="message"
              required
              rows={4}
              className="w-full resize-y rounded-lg border border-[#d8d4cb] px-4 py-2.5 text-[14px] text-[#141413] placeholder:text-muted focus:border-brand-blue focus:outline-none focus:ring-1 focus:ring-brand-blue"
              placeholder={t("contact.messagePlaceholder")}
            />
          </div>
          <button
            type="submit"
            className="w-full rounded-lg bg-brand-blue py-3 text-[13px] font-semibold text-white hover:bg-brand-blue-hover transition-colors"
          >
            {t("contact.submit")}
          </button>
        </form>
      )}

      <p className="mt-6 text-[13px] text-muted">
        {t("contact.preferSelfServe")}{" "}
        <Link href="/pricing" className="font-medium text-brand-blue hover:underline">
          {t("contact.viewPricing")}
        </Link>{" "}
        {t("contact.or")}{" "}
        <Link
          href={process.env.NEXT_PUBLIC_APP_URL || "https://app.spondic.com"}
          className="font-medium text-brand-blue hover:underline"
        >
          {t("contact.signUp")}
        </Link>{" "}
        {t("contact.toTry", { businessName })}
      </p>
    </>
  );
}
