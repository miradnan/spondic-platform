import type { Metadata } from "next";
import HomePageContent from "@/components/HomePageContent";

const businessName = process.env.NEXT_PUBLIC_BUSINESS_NAME || "Spondic";
const domain = process.env.NEXT_PUBLIC_DOMAIN || "spondic.com";
const siteUrl = `https://${domain}`;

export const metadata: Metadata = {
  alternates: {
    canonical: siteUrl,
  },
};

export default function Home() {
  return (
    <>
      {/* Organization Schema */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "Organization",
            name: businessName,
            url: siteUrl,
            logo: `${siteUrl}/icon.svg`,
            description:
              "AI-powered RFP response assistant for enterprise sales teams. Win more RFPs in hours, not weeks.",
            contactPoint: {
              "@type": "ContactPoint",
              contactType: "sales",
              url: `${siteUrl}/contact`,
            },
            sameAs: [],
          }),
        }}
      />
      {/* WebSite Schema for Sitelinks Search */}
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{
          __html: JSON.stringify({
            "@context": "https://schema.org",
            "@type": "WebSite",
            name: businessName,
            url: siteUrl,
          }),
        }}
      />
      <HomePageContent />
    </>
  );
}
