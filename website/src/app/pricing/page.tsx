import type { Metadata } from "next";
import PricingPageContent from "@/components/PricingPageContent";

const businessName = process.env.NEXT_PUBLIC_BUSINESS_NAME || "Spondic";
const domain = process.env.NEXT_PUBLIC_DOMAIN || "spondic.com";
const siteUrl = `https://${domain}`;
const trialPeriod = process.env.NEXT_PUBLIC_TRIAL_PERIOD ?? "14";

export const metadata: Metadata = {
  title: `Pricing — ${businessName} | Plans for Every Team Size`,
  description: `Straightforward pricing for AI-powered RFP response software. Start free for ${trialPeriod} days. No credit card required. Plans for startups to enterprise.`,
  keywords: [
    "RFP software pricing",
    "proposal management pricing",
    "AI RFP tool cost",
    "enterprise proposal software",
    "RFP response plans",
  ],
  openGraph: {
    title: `Pricing — ${businessName}`,
    description: `Straightforward pricing. Start free for ${trialPeriod} days. No credit card required.`,
    url: `${siteUrl}/pricing`,
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: `Pricing — ${businessName}`,
    description: `Straightforward pricing. Start free for ${trialPeriod} days. No credit card required.`,
  },
  alternates: {
    canonical: `${siteUrl}/pricing`,
  },
};

export default function PricingPage() {
  return <PricingPageContent />;
}
