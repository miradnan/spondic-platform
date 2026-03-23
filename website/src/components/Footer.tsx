"use client";

import Link from "next/link";
import Image from "next/image";
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
              <Image
                src="/canada-flag.png"
                alt="Canadian flag"
                width={20}
                height={10}
                className="rounded-sm"
              />
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
