"use client";

import { useTranslation } from "react-i18next";
import ScrollReveal from "./ScrollReveal";

export default function Testimonials() {
  const { t } = useTranslation();
  const businessName = process.env.NEXT_PUBLIC_BUSINESS_NAME || "Spondic";

  const testimonials = [
    {
      quote: t("testimonials.quote1"),
      name: t("testimonials.name1"),
      title: t("testimonials.role1"),
      company: t("testimonials.company1"),
    },
    {
      quote: t("testimonials.quote2"),
      name: t("testimonials.name2"),
      title: t("testimonials.role2"),
      company: t("testimonials.company2"),
    },
    {
      quote: t("testimonials.quote3", { businessName }),
      name: t("testimonials.name3"),
      title: t("testimonials.role3"),
      company: t("testimonials.company3"),
    },
  ];

  return (
    <section className="py-12 sm:py-20 lg:py-28">
      <div className="mx-auto max-w-[1200px] px-4 sm:px-8">
        <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-brand-gold">
          {t("testimonials.label")}
        </p>
        <h2 className="mt-4 max-w-[520px] font-display text-[2rem] font-black italic leading-[1.08] sm:text-[2.8rem] lg:text-[3.2rem]">
          {t("testimonials.title")}
        </h2>

        <div className="mt-14 grid gap-6 grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3">
          {testimonials.map((item, i) => (
            <ScrollReveal key={item.name} delay={i * 120}>
              <div className="flex h-full flex-col rounded-2xl border border-[#d8d4cb] bg-white px-7 py-8">
                {/* Stars */}
                <div className="flex gap-0.5 text-brand-gold">
                  {[...Array(5)].map((_, j) => (
                    <svg key={j} className="h-4 w-4" fill="currentColor" viewBox="0 0 20 20">
                      <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
                    </svg>
                  ))}
                </div>

                <blockquote className="mt-5 flex-1 text-[14px] leading-[1.7] text-[#3a3a38]">
                  &ldquo;{item.quote}&rdquo;
                </blockquote>

                <div className="mt-6 flex items-center gap-3 border-t border-[#d8d4cb]/60 pt-5">
                  {/* Avatar placeholder */}
                  <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-navy text-[14px] font-bold text-white">
                    {item.name.split(" ").map((n) => n[0]).join("")}
                  </div>
                  <div>
                    <p className="text-[13px] font-semibold text-[#141413]">{item.name}</p>
                    <p className="text-[12px] text-muted">
                      {item.title}, {item.company}
                    </p>
                  </div>
                </div>
              </div>
            </ScrollReveal>
          ))}
        </div>
      </div>
    </section>
  );
}
