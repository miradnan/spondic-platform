import type { Metadata } from "next";
import TermsPageContent from "@/components/TermsPageContent";

const businessName = process.env.NEXT_PUBLIC_BUSINESS_NAME || "Spondic";
const domain = process.env.NEXT_PUBLIC_DOMAIN || "spondic.com";
const siteUrl = `https://${domain}`;

export const metadata: Metadata = {
  title: `Terms of Service — ${businessName}`,
  description: `Terms of Service and Service Level Agreement for ${businessName}. Review our terms, SLA commitments, and usage policies.`,
  openGraph: {
    title: `Terms of Service — ${businessName}`,
    description: `Terms of Service and SLA for ${businessName}.`,
    url: `${siteUrl}/terms`,
    type: "website",
  },
  alternates: {
    canonical: `${siteUrl}/terms`,
  },
};

export default function TermsPage() {
  return <TermsPageContent />;
}
