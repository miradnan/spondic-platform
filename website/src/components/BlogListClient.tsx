"use client";

import Link from "next/link";
import { useState } from "react";
import type { BlogPost } from "@/lib/blog";

const categoryColors: Record<string, string> = {
  Product: "bg-brand-blue/10 text-brand-blue",
  Strategy: "bg-purple-100 text-purple-700",
  "AI & Technology": "bg-emerald-100 text-emerald-700",
  Productivity: "bg-amber-100 text-amber-700",
  "How-To": "bg-sky-100 text-sky-700",
  Security: "bg-red-100 text-red-700",
  Industry: "bg-indigo-100 text-indigo-700",
  "Business Case": "bg-orange-100 text-orange-700",
  Compliance: "bg-teal-100 text-teal-700",
};

function formatDate(dateStr: string): string {
  return new Date(dateStr).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });
}

export default function BlogListClient({
  posts,
  categories,
}: {
  posts: BlogPost[];
  categories: string[];
}) {
  const [activeCategory, setActiveCategory] = useState<string | null>(null);

  const filtered = activeCategory
    ? posts.filter((p) => p.category === activeCategory)
    : posts;

  return (
    <>
      {/* Category Filter */}
      <div className="mb-10 flex flex-wrap gap-2">
        <button
          type="button"
          className={`rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors ${
            !activeCategory
              ? "bg-navy text-white"
              : "bg-[#d8d4cb]/30 text-muted hover:text-[#141413]"
          }`}
          onClick={() => setActiveCategory(null)}
        >
          All Posts
        </button>
        {categories.map((cat) => (
          <button
            key={cat}
            type="button"
            className={`rounded-full px-4 py-1.5 text-[13px] font-medium transition-colors ${
              activeCategory === cat
                ? "bg-navy text-white"
                : "bg-[#d8d4cb]/30 text-muted hover:text-[#141413]"
            }`}
            onClick={() => setActiveCategory(cat)}
          >
            {cat}
          </button>
        ))}
      </div>

      {/* Featured Post — shown for "All Posts" or when the featured post matches the active category */}
      {posts.length > 0 && (!activeCategory || posts[0].category === activeCategory) && (
        <Link
          href={`/blog/${posts[0].slug}`}
          className="group mb-12 block rounded-2xl border border-[#d8d4cb] bg-white p-6 shadow-sm transition-shadow hover:shadow-md sm:p-10"
        >
          <span
            className={`inline-block rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${
              categoryColors[posts[0].category] || "bg-gray-100 text-gray-700"
            }`}
          >
            {posts[0].category}
          </span>
          <h2 className="mt-4 font-display text-[24px] font-[900] leading-[1.2] tracking-tight text-navy group-hover:text-brand-blue transition-colors sm:text-[32px]">
            {posts[0].title}
          </h2>
          <p className="mt-3 max-w-[700px] text-[15px] leading-[1.7] text-body">
            {posts[0].description}
          </p>
          <div className="mt-4 flex items-center gap-4 text-[13px] text-muted">
            <span>{formatDate(posts[0].date)}</span>
            <span>·</span>
            <span>{posts[0].readTime}</span>
          </div>
        </Link>
      )}

      {/* Post Grid */}
      <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
        {((!activeCategory || posts[0].category === activeCategory) ? filtered.slice(1) : filtered).map((post) => (
          <Link
            key={post.slug}
            href={`/blog/${post.slug}`}
            className="group flex flex-col rounded-xl border border-[#d8d4cb] bg-white p-5 shadow-sm transition-shadow hover:shadow-md sm:p-6"
          >
            <span
              className={`inline-block self-start rounded-full px-3 py-1 text-[11px] font-semibold uppercase tracking-wide ${
                categoryColors[post.category] || "bg-gray-100 text-gray-700"
              }`}
            >
              {post.category}
            </span>
            <h3 className="mt-3 font-display text-[17px] font-bold leading-[1.3] tracking-tight text-navy group-hover:text-brand-blue transition-colors sm:text-[19px]">
              {post.title}
            </h3>
            <p className="mt-2 line-clamp-3 text-[14px] leading-[1.6] text-body">
              {post.description}
            </p>
            <div className="mt-auto flex items-center gap-3 pt-4 text-[12px] text-muted">
              <span>{formatDate(post.date)}</span>
              <span>·</span>
              <span>{post.readTime}</span>
            </div>
          </Link>
        ))}
      </div>

      {filtered.length === 0 && (
        <p className="py-12 text-center text-muted">
          No posts found in this category.
        </p>
      )}
    </>
  );
}
