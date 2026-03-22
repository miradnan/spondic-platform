import Link from "next/link";
import type { Metadata } from "next";
import { getAllPosts, getPostBySlug } from "@/lib/blog";
import { notFound } from "next/navigation";

const businessName = process.env.NEXT_PUBLIC_BUSINESS_NAME || "Spondic";
const domain = process.env.NEXT_PUBLIC_DOMAIN || "spondic.com";

export function generateStaticParams() {
  return getAllPosts().map((post) => ({ slug: post.slug }));
}

export async function generateMetadata({
  params,
}: {
  params: Promise<{ slug: string }>;
}): Promise<Metadata> {
  const { slug } = await params;
  const post = getPostBySlug(slug);
  if (!post) return {};

  return {
    title: `${post.title} — ${businessName}`,
    description: post.description,
    keywords: post.tags,
    openGraph: {
      title: post.title,
      description: post.description,
      url: `https://${domain}/blog/${post.slug}`,
      type: "article",
      publishedTime: post.date,
      authors: [post.author],
      tags: post.tags,
    },
    twitter: {
      card: "summary_large_image",
      title: post.title,
      description: post.description,
    },
    alternates: {
      canonical: `https://${domain}/blog/${post.slug}`,
    },
  };
}

export default async function BlogPostPage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const post = getPostBySlug(slug);

  if (!post) {
    notFound();
  }

  const allPosts = getAllPosts();
  const currentIndex = allPosts.findIndex((p) => p.slug === post.slug);
  const relatedPosts = allPosts
    .filter((p) => p.slug !== post.slug && p.category === post.category)
    .slice(0, 3);
  const nextPost = allPosts[currentIndex + 1] || null;
  const prevPost = allPosts[currentIndex - 1] || null;

  const formattedDate = new Date(post.date).toLocaleDateString("en-US", {
    year: "numeric",
    month: "long",
    day: "numeric",
  });

  return (
    <>
      {/* JSON-LD Article Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BlogPosting",
            headline: post.title,
            description: post.description,
            datePublished: post.date,
            dateModified: post.date,
            author: {
              "@type": "Organization",
              name: businessName,
              url: `https://${domain}`,
            },
            publisher: {
              "@type": "Organization",
              name: businessName,
              url: `https://${domain}`,
              logo: {
                "@type": "ImageObject",
                url: `https://${domain}/icon.svg`,
              },
            },
            mainEntityOfPage: {
              "@type": "WebPage",
              "@id": `https://${domain}/blog/${post.slug}`,
            },
            keywords: post.tags.join(", "),
          }),
        }}
      />

      {/* Breadcrumb JSON-LD */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "BreadcrumbList",
            itemListElement: [
              {
                "@type": "ListItem",
                position: 1,
                name: "Home",
                item: `https://${domain}`,
              },
              {
                "@type": "ListItem",
                position: 2,
                name: "Blog",
                item: `https://${domain}/blog`,
              },
              {
                "@type": "ListItem",
                position: 3,
                name: post.title,
                item: `https://${domain}/blog/${post.slug}`,
              },
            ],
          }),
        }}
      />

      {/* Article Header */}
      <section className="border-b border-[#d8d4cb] bg-cream-light py-12 sm:py-16">
        <div className="mx-auto max-w-[760px] px-4 sm:px-8">
          {/* Breadcrumbs */}
          <nav className="mb-6 text-[13px] text-muted">
            <Link href="/" className="hover:text-[#141413] transition-colors">
              Home
            </Link>
            <span className="mx-2">/</span>
            <Link
              href="/blog"
              className="hover:text-[#141413] transition-colors"
            >
              Blog
            </Link>
            <span className="mx-2">/</span>
            <span className="text-[#141413]">{post.category}</span>
          </nav>

          <span className="inline-block rounded-full bg-brand-blue/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-brand-blue">
            {post.category}
          </span>

          <h1 className="mt-4 font-display text-[28px] font-[900] leading-[1.15] tracking-tight text-navy sm:text-[40px]">
            {post.title}
          </h1>

          <p className="mt-4 text-[16px] leading-[1.7] text-body sm:text-[18px]">
            {post.description}
          </p>

          <div className="mt-6 flex flex-wrap items-center gap-4 text-[13px] text-muted">
            <div className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-full bg-navy text-[12px] font-bold text-white">
                S
              </div>
              <div>
                <p className="font-medium text-[#141413]">{post.author}</p>
                <p className="text-[12px]">{post.authorRole}</p>
              </div>
            </div>
            <span className="hidden sm:inline">·</span>
            <span>{formattedDate}</span>
            <span>·</span>
            <span>{post.readTime}</span>
          </div>
        </div>
      </section>

      {/* Article Content */}
      <article className="py-12 sm:py-16">
        <div className="mx-auto max-w-[760px] px-4 sm:px-8">
          <div
            className="prose prose-lg max-w-none
              prose-headings:font-display prose-headings:font-bold prose-headings:tracking-tight prose-headings:text-navy
              prose-h2:mt-10 prose-h2:text-[24px] sm:prose-h2:text-[28px]
              prose-h3:mt-8 prose-h3:text-[19px] sm:prose-h3:text-[22px]
              prose-p:text-body prose-p:leading-[1.8] prose-p:text-[15px] sm:prose-p:text-[16px]
              prose-li:text-body prose-li:text-[15px] sm:prose-li:text-[16px]
              prose-strong:text-[#141413]
              prose-a:text-brand-blue prose-a:no-underline hover:prose-a:underline
              prose-table:border-collapse prose-table:text-[14px]
              prose-th:border prose-th:border-[#d8d4cb] prose-th:bg-cream-light prose-th:px-4 prose-th:py-2 prose-th:text-left prose-th:font-semibold prose-th:text-navy
              prose-td:border prose-td:border-[#d8d4cb] prose-td:px-4 prose-td:py-2 prose-td:text-body
              prose-code:rounded prose-code:bg-[#d8d4cb]/30 prose-code:px-1.5 prose-code:py-0.5 prose-code:text-[14px] prose-code:text-navy prose-code:before:content-none prose-code:after:content-none
              prose-pre:rounded-lg prose-pre:bg-navy prose-pre:text-[14px]
              prose-blockquote:border-l-brand-blue prose-blockquote:text-body
              prose-hr:border-[#d8d4cb]
            "
            dangerouslySetInnerHTML={{ __html: markdownToHtml(post.content) }}
          />

          {/* Tags */}
          <div className="mt-12 border-t border-[#d8d4cb] pt-8">
            <p className="mb-3 text-[13px] font-semibold uppercase tracking-wide text-muted">
              Tags
            </p>
            <div className="flex flex-wrap gap-2">
              {post.tags.map((tag) => (
                <span
                  key={tag}
                  className="rounded-full bg-[#d8d4cb]/30 px-3 py-1 text-[12px] font-medium text-muted"
                >
                  {tag}
                </span>
              ))}
            </div>
          </div>

          {/* Post Navigation */}
          <div className="mt-10 grid gap-4 border-t border-[#d8d4cb] pt-8 sm:grid-cols-2">
            {prevPost && (
              <Link
                href={`/blog/${prevPost.slug}`}
                className="group rounded-lg border border-[#d8d4cb] p-4 transition-shadow hover:shadow-md"
              >
                <p className="text-[12px] font-medium text-muted">
                  Previous Article
                </p>
                <p className="mt-1 text-[14px] font-semibold text-navy group-hover:text-brand-blue transition-colors line-clamp-2">
                  {prevPost.title}
                </p>
              </Link>
            )}
            {nextPost && (
              <Link
                href={`/blog/${nextPost.slug}`}
                className="group rounded-lg border border-[#d8d4cb] p-4 text-right transition-shadow hover:shadow-md sm:col-start-2"
              >
                <p className="text-[12px] font-medium text-muted">
                  Next Article
                </p>
                <p className="mt-1 text-[14px] font-semibold text-navy group-hover:text-brand-blue transition-colors line-clamp-2">
                  {nextPost.title}
                </p>
              </Link>
            )}
          </div>
        </div>
      </article>

      {/* Related Posts */}
      {relatedPosts.length > 0 && (
        <section className="border-t border-[#d8d4cb] bg-cream-light py-12 sm:py-16">
          <div className="mx-auto max-w-[1200px] px-4 sm:px-8">
            <h2 className="font-display text-[24px] font-[900] tracking-tight text-navy sm:text-[28px]">
              Related Articles
            </h2>
            <div className="mt-8 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
              {relatedPosts.map((rp) => (
                <Link
                  key={rp.slug}
                  href={`/blog/${rp.slug}`}
                  className="group flex flex-col rounded-xl border border-[#d8d4cb] bg-white p-5 shadow-sm transition-shadow hover:shadow-md"
                >
                  <span className="inline-block self-start rounded-full bg-brand-blue/10 px-3 py-1 text-[11px] font-semibold uppercase tracking-wide text-brand-blue">
                    {rp.category}
                  </span>
                  <h3 className="mt-3 text-[16px] font-bold leading-[1.3] text-navy group-hover:text-brand-blue transition-colors">
                    {rp.title}
                  </h3>
                  <p className="mt-2 line-clamp-2 text-[13px] leading-[1.6] text-body">
                    {rp.description}
                  </p>
                  <span className="mt-auto pt-3 text-[12px] text-muted">
                    {rp.readTime}
                  </span>
                </Link>
              ))}
            </div>
          </div>
        </section>
      )}

      {/* CTA */}
      <section className="bg-navy py-14 sm:py-16">
        <div className="mx-auto max-w-[600px] px-4 text-center sm:px-8">
          <h2 className="font-display text-[24px] font-[900] leading-[1.15] text-white sm:text-[32px]">
            Start Winning More RFPs Today
          </h2>
          <p className="mt-3 text-[15px] leading-[1.7] text-white/70">
            See how Spondic&apos;s AI-powered platform helps enterprise sales
            teams respond to RFPs 5x faster.
          </p>
          <div className="mt-8 flex flex-col items-center gap-3 sm:flex-row sm:justify-center">
            <Link
              href="/contact"
              className="rounded-md bg-brand-blue px-8 py-3.5 text-[15px] font-semibold text-white hover:bg-brand-blue-hover transition-colors"
            >
              Book a Demo
            </Link>
            <Link
              href="/blog"
              className="rounded-md border-2 border-white/20 px-8 py-3 text-[15px] font-semibold text-white hover:border-white/40 transition-colors"
            >
              More Articles
            </Link>
          </div>
        </div>
      </section>
    </>
  );
}

/**
 * Simple markdown to HTML converter for blog content.
 * Handles: headings, paragraphs, bold, italic, links, lists, tables, code blocks, inline code, horizontal rules, blockquotes.
 */
function markdownToHtml(md: string): string {
  const lines = md.split("\n");
  let html = "";
  let inList = false;
  let listType: "ul" | "ol" = "ul";
  let inTable = false;
  let tableHeader = false;
  let inCodeBlock = false;
  let codeContent = "";
  let inBlockquote = false;

  for (let i = 0; i < lines.length; i++) {
    let line = lines[i];

    // Code blocks
    if (line.trim().startsWith("```")) {
      if (inCodeBlock) {
        html += `<pre><code>${escapeHtml(codeContent.trim())}</code></pre>`;
        codeContent = "";
        inCodeBlock = false;
      } else {
        if (inList) { html += listType === "ul" ? "</ul>" : "</ol>"; inList = false; }
        if (inBlockquote) { html += "</blockquote>"; inBlockquote = false; }
        inCodeBlock = true;
      }
      continue;
    }
    if (inCodeBlock) {
      codeContent += line + "\n";
      continue;
    }

    // Close list if needed
    if (inList && !line.match(/^(\s*[-*]\s|^\s*\d+\.\s)/) && line.trim() !== "") {
      html += listType === "ul" ? "</ul>" : "</ol>";
      inList = false;
    }

    // Table
    if (line.trim().startsWith("|")) {
      if (!inTable) {
        if (inList) { html += listType === "ul" ? "</ul>" : "</ol>"; inList = false; }
        html += "<table>";
        inTable = true;
        tableHeader = true;
      }

      // Skip separator rows (|---|---|)
      if (line.match(/^\|[\s-:|]+\|$/)) {
        tableHeader = false;
        continue;
      }

      const cells = line.split("|").filter((c, idx, arr) => idx > 0 && idx < arr.length - 1);
      const tag = tableHeader ? "th" : "td";
      html += "<tr>";
      for (const cell of cells) {
        html += `<${tag}>${inlineMarkdown(cell.trim())}</${tag}>`;
      }
      html += "</tr>";
      continue;
    } else if (inTable) {
      html += "</table>";
      inTable = false;
      tableHeader = false;
    }

    // Blockquote
    if (line.trim().startsWith("> ")) {
      if (!inBlockquote) {
        html += "<blockquote>";
        inBlockquote = true;
      }
      html += `<p>${inlineMarkdown(line.trim().slice(2))}</p>`;
      continue;
    } else if (inBlockquote && line.trim() === "") {
      html += "</blockquote>";
      inBlockquote = false;
    }

    // Empty line
    if (line.trim() === "") continue;

    // Headings
    const headingMatch = line.match(/^(#{1,6})\s+(.+)$/);
    if (headingMatch) {
      const level = headingMatch[1].length;
      const text = headingMatch[2];
      const id = text.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/(^-|-$)/g, "");
      html += `<h${level} id="${id}">${inlineMarkdown(text)}</h${level}>`;
      continue;
    }

    // Horizontal rule
    if (line.match(/^(-{3,}|\*{3,}|_{3,})$/)) {
      html += "<hr>";
      continue;
    }

    // Unordered list
    if (line.match(/^\s*[-*]\s+/)) {
      if (!inList || listType !== "ul") {
        if (inList) html += listType === "ul" ? "</ul>" : "</ol>";
        html += "<ul>";
        inList = true;
        listType = "ul";
      }
      html += `<li>${inlineMarkdown(line.replace(/^\s*[-*]\s+/, ""))}</li>`;
      continue;
    }

    // Ordered list
    if (line.match(/^\s*\d+\.\s+/)) {
      if (!inList || listType !== "ol") {
        if (inList) html += listType === "ul" ? "</ul>" : "</ol>";
        html += "<ol>";
        inList = true;
        listType = "ol";
      }
      html += `<li>${inlineMarkdown(line.replace(/^\s*\d+\.\s+/, ""))}</li>`;
      continue;
    }

    // Paragraph
    html += `<p>${inlineMarkdown(line)}</p>`;
  }

  // Close any open tags
  if (inList) html += listType === "ul" ? "</ul>" : "</ol>";
  if (inTable) html += "</table>";
  if (inBlockquote) html += "</blockquote>";

  return html;
}

function inlineMarkdown(text: string): string {
  // Bold
  text = text.replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>");
  // Italic
  text = text.replace(/\*(.+?)\*/g, "<em>$1</em>");
  // Inline code
  text = text.replace(/`([^`]+)`/g, "<code>$1</code>");
  // Links
  text = text.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return text;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;");
}
