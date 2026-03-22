import type { Metadata } from "next";
import PrivacyPageContent from "@/components/PrivacyPageContent";

const businessName = process.env.NEXT_PUBLIC_BUSINESS_NAME || "Spondic";
const domain = process.env.NEXT_PUBLIC_DOMAIN || "spondic.com";
const siteUrl = `https://${domain}`;

export const metadata: Metadata = {
  title: `Privacy Policy — ${businessName}`,
  description: `Privacy Policy for ${businessName}. How we collect, use, and protect your information. GDPR compliant with data residency options.`,
  openGraph: {
    title: `Privacy Policy — ${businessName}`,
    description: `How ${businessName} collects, uses, and protects your information.`,
    url: `${siteUrl}/privacy`,
    type: "website",
  },
  alternates: {
    canonical: `${siteUrl}/privacy`,
  },
};

export default function PrivacyPage() {
  return <PrivacyPageContent />;
}
