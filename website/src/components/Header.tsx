"use client";

import Link from "next/link";
import { useState } from "react";
import { useTranslation } from "react-i18next";
import LanguageSwitcher from "./LanguageSwitcher";

export default function Header() {
  const appUrl = process.env.NEXT_PUBLIC_APP_URL || "https://app.spondic.com";
  const businessName = process.env.NEXT_PUBLIC_BUSINESS_NAME || "Spondic";
  const [menuOpen, setMenuOpen] = useState(false);
  const { t } = useTranslation();

  return (
    <header className="sticky top-0 z-30 border-b border-[#d8d4cb] bg-cream">
      <div className="mx-auto flex max-w-[1200px] items-center justify-between px-4 py-4 sm:px-8 sm:py-5">
        <Link
          href="/"
          className="font-logo text-[22px] font-bold tracking-tight uppercase text-[#141413] hover:text-brand-blue transition-colors sm:text-[27px]"
        >
          {businessName}
        </Link>

        {/* Desktop nav */}
        <nav className="hidden items-center gap-6 text-[14px] font-medium md:flex">
          <Link href="/#how-it-works" className="text-muted hover:text-[#141413] transition-colors">
            {t("nav.howItWorks")}
          </Link>
          <Link href="/product" className="text-muted hover:text-[#141413] transition-colors">
            {t("nav.product")}
          </Link>
          <Link href="/#pricing" className="text-muted hover:text-[#141413] transition-colors">
            {t("nav.pricing")}
          </Link>
          <Link href="/contact" className="text-muted hover:text-[#141413] transition-colors">
            {t("nav.contact")}
          </Link>
          <Link href="/blog" className="text-muted hover:text-[#141413] transition-colors">
            Blog
          </Link>
          <LanguageSwitcher />
          <Link
            href="/contact"
            className="rounded-md border-2 border-[#141413]/15 px-5 py-2 text-[14px] font-semibold text-[#141413] hover:border-brand-blue hover:text-brand-blue transition-colors"
          >
            {t("nav.bookDemo")}
          </Link>
          <Link
            href={appUrl}
            className="rounded-md bg-brand-blue px-5 py-2.5 text-[14px] font-semibold text-white hover:bg-brand-blue-hover transition-colors"
          >
            {t("nav.getStarted")}
          </Link>
        </nav>

        {/* Mobile: language switcher + hamburger */}
        <div className="flex items-center gap-2 md:hidden">
          <LanguageSwitcher />
          <button
            type="button"
            aria-label={menuOpen ? "Close menu" : "Open menu"}
            aria-expanded={menuOpen}
            className="flex h-11 w-11 items-center justify-center rounded-md text-[#141413] hover:bg-[#d8d4cb]/30 transition-colors"
            onClick={() => setMenuOpen((o) => !o)}
          >
            {menuOpen ? (
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="h-6 w-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 6h16M4 12h16M4 18h16" />
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Mobile nav dropdown */}
      {menuOpen && (
        <div className="absolute left-0 right-0 top-full z-20 border-b border-[#d8d4cb] bg-cream shadow-lg md:hidden">
          <nav className="mx-auto flex max-w-[1200px] flex-col gap-0 px-4 py-4 sm:px-8">
            <Link
              href="#how-it-works"
              className="rounded-md px-4 py-3 text-[14px] font-medium text-muted hover:bg-[#d8d4cb]/20 hover:text-[#141413]"
              onClick={() => setMenuOpen(false)}
            >
              {t("nav.howItWorks")}
            </Link>
            <Link
              href="/product"
              className="rounded-md px-4 py-3 text-[14px] font-medium text-muted hover:bg-[#d8d4cb]/20 hover:text-[#141413]"
              onClick={() => setMenuOpen(false)}
            >
              {t("nav.product")}
            </Link>
            <Link
              href="/#pricing"
              className="rounded-md px-4 py-3 text-[14px] font-medium text-muted hover:bg-[#d8d4cb]/20 hover:text-[#141413]"
              onClick={() => setMenuOpen(false)}
            >
              {t("nav.pricing")}
            </Link>
            <Link
              href="/contact"
              className="rounded-md px-4 py-3 text-[14px] font-medium text-muted hover:bg-[#d8d4cb]/20 hover:text-[#141413]"
              onClick={() => setMenuOpen(false)}
            >
              {t("nav.contact")}
            </Link>
            <Link
              href="/blog"
              className="rounded-md px-4 py-3 text-[14px] font-medium text-muted hover:bg-[#d8d4cb]/20 hover:text-[#141413]"
              onClick={() => setMenuOpen(false)}
            >
              Blog
            </Link>
            <Link
              href="/contact"
              className="mx-4 mt-2 rounded-md border-2 border-[#141413]/15 px-5 py-3 text-center text-[14px] font-semibold text-[#141413] hover:border-brand-blue hover:text-brand-blue transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              {t("nav.bookDemo")}
            </Link>
            <Link
              href={appUrl}
              className="mx-4 mt-2 rounded-md bg-brand-blue px-5 py-3 text-center text-[14px] font-semibold text-white hover:bg-brand-blue-hover transition-colors"
              onClick={() => setMenuOpen(false)}
            >
              {t("nav.getStarted")}
            </Link>
          </nav>
        </div>
      )}
    </header>
  );
}
