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
              <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 36 36" className="h-5 w-5 rounded-sm" aria-label="Canadian flag">
                <path fill="#D52B1E" d="M4 5a4 4 0 0 0-4 4v18a4 4 0 0 0 4 4h6V5H4z"/>
                <path fill="#FFF" d="M10 5h16v26H10z"/>
                <path fill="#D52B1E" d="M32 5h-6v26h6a4 4 0 0 0 4-4V9a4 4 0 0 0-4-4z"/>
                <path fill="#D52B1E" d="M18.615 22.113c1.198.139 2.272.264 3.47.401l-1.05-2.49c-.093-.224.063-.39.283-.31l2.837 1.06-.543-3.027c-.048-.263.123-.291.263-.143l2.09 2.2.14-.463c.058-.2.204-.271.392-.166l.537.3-.757-2.87a.237.237 0 0 1 .105-.27l1.19-.744-2.09-.338a.262.262 0 0 1-.216-.2l-.5-1.794-1.612 1.667a.3.3 0 0 1-.347.06L21.347 14l.5 2.452a.244.244 0 0 1-.183.287l-1.326.353.96 1.228c.112.144.015.382-.163.337l-3.134-.784v2.665c0 .455-.479.399-.592.15l-1.453-3.208-.37.927a.274.274 0 0 1-.384.14L13.856 17.6l.507 2.058a.282.282 0 0 1-.133.308l-.835.496 1.326.336c.17.044.228.12.188.283l-.353 1.397 1.875-1.326a.27.27 0 0 1 .348.023l1.205 1.348-.206-2.318a.233.233 0 0 1 .165-.244l.98-.313-.99-1.263a.207.207 0 0 1 .078-.32l1.221-.566-.747-.876a.194.194 0 0 1 .015-.268l1.09-.953-1.794-.473a.237.237 0 0 1-.16-.334l.677-1.425-1.612.508a.271.271 0 0 1-.326-.152l-.996-2.306-.996 2.306a.271.271 0 0 1-.326.152l-1.612-.508.677 1.425a.237.237 0 0 1-.16.334l-1.794.473 1.09.953a.194.194 0 0 1 .015.268l-.747.876 1.221.566a.207.207 0 0 1 .078.32l-.99 1.263.98.313a.233.233 0 0 1 .165.244l-.206 2.318 1.205-1.348a.27.27 0 0 1 .348-.023l1.875 1.326-.353-1.397c-.04-.164.018-.24.188-.283l1.326-.336-.835-.496a.282.282 0 0 1-.133-.308l.507-2.058-1.346.727a.274.274 0 0 1-.384-.14l-.37-.927-1.453 3.209c-.113.249-.592.304-.592-.15v-2.666l-3.134.784c-.178.045-.275-.193-.163-.337l.96-1.228-1.326-.353a.244.244 0 0 1-.183-.287L14.653 14l-1.656.906a.3.3 0 0 1-.347-.06l-1.612-1.668-.5 1.794a.262.262 0 0 1-.216.2l-2.09.339 1.19.744a.237.237 0 0 1 .105.27l-.757 2.87.537-.3c.188-.105.334-.034.392.166l.14.463 2.09-2.2c.14-.148.311-.12.263.142l-.543 3.028 2.837-1.06c.22-.08.376.086.283.31l-1.05 2.49c1.198-.138 2.272-.263 3.47-.402.156-.018.326.013.326.266v1.27h1.216v-1.27c0-.253.17-.284.326-.266z"/>
              </svg>
            </span>
          </div>
        </div>
      </div>
    </footer>
  );
}
