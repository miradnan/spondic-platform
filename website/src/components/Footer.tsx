"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";

export default function Footer() {
  const businessName = process.env.NEXT_PUBLIC_BUSINESS_NAME || "Spondic";
  const { t } = useTranslation();

  return (
    <footer className="border-t border-white/10 bg-navy">
      <div className="mx-auto max-w-[1200px] px-4 py-12 sm:px-8 sm:py-16">
        {/* Top: Logo + Nav columns */}
        <div className="grid gap-10 sm:grid-cols-2 lg:grid-cols-4">
          {/* Brand column */}
          <div className="sm:col-span-2 lg:col-span-1">
            <span className="font-logo text-[22px] font-bold tracking-tight uppercase text-white">
              {businessName}
            </span>
            <p className="mt-4 text-[13px] leading-[1.7] text-white/50 max-w-[260px]">
              AI-powered RFP response platform for enterprise sales teams. Draft winning proposals faster.
            </p>
          </div>

          {/* Product column */}
          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/40 mb-4">
              {t("footer.product")}
            </h4>
            <nav className="flex flex-col gap-2.5 text-[14px] text-white/70">
              <Link href="/#how-it-works" className="hover:text-white transition-colors w-fit">
                {t("nav.howItWorks")}
              </Link>
              <Link href="/product" className="hover:text-white transition-colors w-fit">
                {t("footer.product")}
              </Link>
              <Link href="/#pricing" className="hover:text-white transition-colors w-fit">
                {t("footer.pricing")}
              </Link>
            </nav>
          </div>

          {/* Company column */}
          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/40 mb-4">
              {t("footer.company")}
            </h4>
            <nav className="flex flex-col gap-2.5 text-[14px] text-white/70">
              <Link href="/contact" className="hover:text-white transition-colors w-fit">
                {t("footer.contact")}
              </Link>
              <Link href="/blog" className="hover:text-white transition-colors w-fit">
                {t("footer.blog")}
              </Link>
            </nav>
          </div>

          {/* Legal column */}
          <div>
            <h4 className="text-[11px] font-semibold uppercase tracking-[0.15em] text-white/40 mb-4">
              {t("footer.legal")}
            </h4>
            <nav className="flex flex-col gap-2.5 text-[14px] text-white/70">
              <Link href="/terms" className="hover:text-white transition-colors w-fit">
                {t("footer.termsOfService")}
              </Link>
              <Link href="/privacy" className="hover:text-white transition-colors w-fit">
                {t("footer.privacyPolicy")}
              </Link>
            </nav>
          </div>
        </div>

        {/* Divider */}
        <div className="mt-12 border-t border-white/10" />

        {/* Bottom: Copyright + Made with love */}
        <div className="mt-8 flex flex-col items-center gap-4 sm:flex-row sm:justify-between">
          <p className="text-[13px] text-white/40">
            &copy; {new Date().getFullYear()} {businessName} Inc. {t("footer.rights")}
          </p>

          <div className="flex items-center gap-2 text-[13px] text-white/50">
            <span>{t("footer.madeWithLove")}</span>
            <span className="inline-flex items-center gap-1">
              <svg viewBox="0 0 9600 4800" className="h-4 w-4 rounded-sm" aria-label="Canadian flag">
                <path fill="#f00" d="M0 0h2400v4800H0z"/>
                <path fill="#fff" d="M2400 0h4800v4800H2400z"/>
                <path fill="#f00" d="M7200 0h2400v4800H7200z"/>
                <path fill="#f00" d="M4020 2230l-89-275-209 142 77-258-236 49 142-209-275-89 275-89-142-209 236 49-77-258 209 142 89-275 89 275 209-142-77 258 236-49-142 209 275 89-275 89 142 209-236-49 77 258-209-142z" transform="translate(780 582) scale(1.3)"/>
              </svg>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
