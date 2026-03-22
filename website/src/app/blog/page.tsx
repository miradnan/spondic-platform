import Link from "next/link";
import type { Metadata } from "next";
import { getAllPosts, getAllCategories } from "@/lib/blog";
import BlogListClient from "@/components/BlogListClient";

const businessName = process.env.NEXT_PUBLIC_BUSINESS_NAME || "Spondic";
const domain = process.env.NEXT_PUBLIC_DOMAIN || "spondic.com";

export const metadata: Metadata = {
  title: `Blog — ${businessName} | RFP Response Tips, AI Insights & Enterprise Sales Strategies`,
  description:
    "Expert insights on RFP response best practices, AI-powered proposal writing, enterprise sales productivity, and data security. Learn how to win more RFPs faster.",
  keywords: [
    "RFP response blog",
    "proposal writing tips",
    "AI proposal writing",
    "enterprise sales blog",
    "RFP best practices",
    "proposal management",
    "sales productivity",
    "RFP software blog",
  ],
  openGraph: {
    title: `Blog — ${businessName}`,
    description:
      "Expert insights on RFP response best practices, AI-powered proposal writing, and enterprise sales strategies.",
    url: `https://${domain}/blog`,
    type: "website",
  },
  alternates: {
    canonical: `https://${domain}/blog`,
  },
};

export default function BlogPage() {
  const posts = getAllPosts();
  const categories = getAllCategories();

  return (
    <>
      {/* JSON-LD for Blog */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Blog",
            name: `${businessName} Blog`,
            description:
              "Expert insights on RFP response best practices, AI-powered proposal writing, and enterprise sales strategies.",
            url: `https://${domain}/blog`,
            publisher: {
              "@type": "Organization",
              name: businessName,
              url: `https://${domain}`,
            },
            blogPost: posts.slice(0, 10).map((post) => ({
              "@type": "BlogPosting",
              headline: post.title,
              description: post.description,
              datePublished: post.date,
              author: {
                "@type": "Organization",
                name: businessName,
              },
              url: `https://${domain}/blog/${post.slug}`,
            })),
          }),
        }}
      />

      {/* Hero */}
      <section className="bg-navy py-16 sm:py-20">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-8">
          <p className="text-[13px] font-semibold uppercase tracking-[0.15em] text-brand-gold">
            Blog
          </p>
          <h1 className="mt-3 font-display text-[32px] font-[900] leading-[1.15] tracking-tight text-white sm:text-[44px]">
            Insights for Winning More RFPs
          </h1>
          <p className="mt-4 max-w-[600px] text-[16px] leading-[1.7] text-white/70 sm:text-[18px]">
            Expert strategies on AI-powered proposal writing, enterprise sales
            productivity, data security, and RFP best practices.
          </p>
        </div>
      </section>

      {/* Blog Grid */}
      <section className="py-16 sm:py-20">
        <div className="mx-auto max-w-[1200px] px-4 sm:px-8">
          <BlogListClient posts={posts} categories={categories} />
        </div>
      </section>

      {/* CTA */}
      <section className="border-t border-[#d8d4cb] bg-cream-light py-16 sm:py-20">
        <div className="mx-auto max-w-[700px] px-4 text-center sm:px-8">
          <h2 className="font-display text-[28px] font-[900] leading-[1.15] tracking-tight text-navy sm:text-[36px]">
            Ready to Win More RFPs?
          </h2>
          <p className="mt-4 text-[16px] leading-[1.7] text-body">
            See how Spondic helps enterprise sales teams respond to RFPs 5x
            faster with AI-powered draft generation from your own knowledge
            base.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/contact"
              className="rounded-md bg-brand-blue px-8 py-3.5 text-[15px] font-semibold text-white hover:bg-brand-blue-hover transition-colors"
            >
              Book a Demo
            </Link>
            <Link
              href="/product"
              className="rounded-md border-2 border-[#141413]/15 px-8 py-3 text-[15px] font-semibold text-[#141413] hover:border-brand-blue hover:text-brand-blue transition-colors"
            >
              See How It Works
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}
