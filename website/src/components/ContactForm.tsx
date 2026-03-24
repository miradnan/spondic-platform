"use client";

import { useState } from "react";
import Link from "next/link";
import { useTranslation } from "react-i18next";

export default function ContactForm() {
  const [submitted, setSubmitted] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");
  const { t } = useTranslation();
  const businessName = process.env.NEXT_PUBLIC_BUSINESS_NAME || "Spondic";

  async function handleSubmit(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSubmitting(true);
    setError("");

    const formData = new FormData(e.currentTarget);
    const data = {
      fullName: formData.get("fullName"),
      email: formData.get("email"),
      organization: formData.get("organization"),
      message: formData.get("message"),
    };

    try {
      const res = await fetch("/.netlify/functions/contact", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(data),
      });

      if (!res.ok) throw new Error("Failed to send");
      setSubmitted(true);
    } catch {
      setError("Something went wrong. Please email us directly at hello@spondic.com");
    } finally {
      setSubmitting(false);
    }
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
              {t("contact.fullName")} <span className="text-red-500">*</span>
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
              {t("contact.email")} <span className="text-red-500">*</span>
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
              {t("contact.organization")} <span className="font-normal text-muted">(optional)</span>
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
              {t("contact.message")} <span className="text-red-500">*</span>
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
          {error && (
            <p className="rounded-lg bg-red-50 px-4 py-3 text-[13px] text-red-700">
              {error}
            </p>
          )}
          <button
            type="submit"
            disabled={submitting}
            className="w-full rounded-lg bg-brand-blue py-3 text-[13px] font-semibold text-white hover:bg-brand-blue-hover transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
          >
            {submitting ? (
              <span className="inline-flex items-center gap-2">
                <svg className="h-4 w-4 animate-spin" viewBox="0 0 24 24" fill="none">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4" />
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4z" />
                </svg>
                {t("contact.sending", "Sending...")}
              </span>
            ) : (
              t("contact.submit")
            )}
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
