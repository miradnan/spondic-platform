import Link from "next/link";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Page Not Found — Spondic",
  description: "The page you're looking for doesn't exist. Browse our blog, explore our product, or contact us.",
};

export default function NotFound() {
  return (
    <section className="py-24 sm:py-32">
      <div className="mx-auto max-w-[600px] px-4 text-center sm:px-8">
        <p className="text-[13px] font-semibold uppercase tracking-[0.15em] text-brand-gold">
          404
        </p>
        <h1 className="mt-3 font-display text-[36px] font-[900] leading-[1.15] tracking-tight text-navy sm:text-[48px]">
          Page Not Found
        </h1>
        <p className="mt-4 text-[16px] leading-[1.7] text-body">
          The page you&apos;re looking for doesn&apos;t exist or has been moved.
          Here are some helpful links to get you back on track.
        </p>
        <div className="mt-10 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
          <Link
            href="/"
            className="rounded-md bg-brand-blue px-8 py-3.5 text-[15px] font-semibold text-white hover:bg-brand-blue-hover transition-colors"
          >
            Go Home
          </Link>
          <Link
            href="/blog"
            className="rounded-md border-2 border-[#141413]/15 px-8 py-3 text-[15px] font-semibold text-[#141413] hover:border-brand-blue hover:text-brand-blue transition-colors"
          >
            Read Our Blog
          </Link>
        </div>
        <div className="mt-12 flex flex-wrap justify-center gap-6 text-[14px] font-medium text-muted">
          <Link href="/product" className="hover:text-brand-blue transition-colors">
            Product
          </Link>
          <Link href="/pricing" className="hover:text-brand-blue transition-colors">
            Pricing
          </Link>
          <Link href="/contact" className="hover:text-brand-blue transition-colors">
            Contact Us
          </Link>
        </div>
      </div>
    </section>
  );
}
