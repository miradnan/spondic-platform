import type { Metadata } from "next";
import ProductPageContent from "@/components/ProductPageContent";

const businessName = process.env.NEXT_PUBLIC_BUSINESS_NAME || "Spondic";
const domain = process.env.NEXT_PUBLIC_DOMAIN || "spondic.com";
const siteUrl = `https://${domain}`;

export const metadata: Metadata = {
  title: `Product — ${businessName} | AI-Powered RFP Response Assistant`,
  description:
    "Upload your RFP, get AI-generated draft answers from your knowledge base with source citations. Built for enterprise sales teams in regulated industries.",
  keywords: [
    "RFP response software",
    "AI proposal writing",
    "proposal automation",
    "knowledge base",
    "sales enablement",
    "enterprise RFP tool",
  ],
  openGraph: {
    title: `Product — ${businessName}`,
    description:
      "Upload your RFP, get AI-generated draft answers from your knowledge base with source citations.",
    url: `${siteUrl}/product`,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `Product — ${businessName}`,
    description:
      "AI-powered RFP response assistant. Upload, draft, review — respond to RFPs 5x faster.",
  },
  alternates: {
    canonical: `${siteUrl}/product`,
  },
};

export default function ProductPage() {
  return <ProductPageContent />;
}
