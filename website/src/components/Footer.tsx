"use client";

import Link from "next/link";
import { useTranslation } from "react-i18next";

export default function Footer() {
  const businessName = process.env.NEXT_PUBLIC_BUSINESS_NAME || "Spondic";
  const { t } = useTranslation();

  return (
    <footer className="border-t border-white/10 bg-navy">
      <div className="mx-auto max-w-[1200px] px-4 py-10 sm:px-8 sm:py-12">
        <div className="flex flex-col items-center gap-8 sm:flex-row sm:items-start sm:justify-between">
          <Link
            href="/"
            className="font-logo text-[27px] font-bold tracking-tight uppercase text-white hover:text-white/90 transition-colors"
          >
            {businessName}
          </Link>
          <nav className="flex flex-wrap items-center justify-center gap-6 text-[14px] font-medium text-white/80">
            <Link href="/#how-it-works" className="hover:text-white transition-colors">
              {t("nav.howItWorks")}
            </Link>
            <Link href="/product" className="hover:text-white transition-colors">
              {t("nav.product")}
            </Link>
            <Link href="/#pricing" className="hover:text-white transition-colors">
              {t("nav.pricing")}
            </Link>
            <Link href="/contact" className="hover:text-white transition-colors">
              {t("nav.contact")}
            </Link>
            <Link href="/blog" className="hover:text-white transition-colors">
              Blog
            </Link>
          </nav>
        </div>
        <div className="mt-8 border-t border-white/10 pt-8 text-center text-[13px] text-white/50">
          &copy; {new Date().getFullYear()} {businessName}. {t("footer.rights")}{" "}
          <Link href="/terms" className="hover:text-white/70 transition-colors">{t("footer.termsOfService")}</Link>
          {" \u00B7 "}
          <Link href="/privacy" className="hover:text-white/70 transition-colors">{t("footer.privacyPolicy")}</Link>
        </div>
      </div>
    </footer>
  );
}
