import type { Metadata } from "next";
import ContactPageContent from "@/components/ContactPageContent";

const businessName = process.env.NEXT_PUBLIC_BUSINESS_NAME || "Spondic";
const domain = process.env.NEXT_PUBLIC_DOMAIN || "spondic.com";
const siteUrl = `https://${domain}`;

export const metadata: Metadata = {
  title: `Contact Us — ${businessName} | Book a Demo or Get in Touch`,
  description: `Get in touch with the ${businessName} team. Book a demo, ask about enterprise plans, or reach out for support and partnerships.`,
  keywords: [
    "contact Spondic",
    "book a demo",
    "RFP software demo",
    "enterprise sales demo",
    "proposal software support",
  ],
  openGraph: {
    title: `Contact Us — ${businessName}`,
    description: `Get in touch with the ${businessName} team. Book a demo or send us a message.`,
    url: `${siteUrl}/contact`,
    type: "website",
  },
  twitter: {
    card: "summary",
    title: `Contact Us — ${businessName}`,
    description: `Get in touch with the ${businessName} team. Book a demo or send us a message.`,
  },
  alternates: {
    canonical: `${siteUrl}/contact`,
  },
};

export default function ContactPage() {
  return <ContactPageContent />;
}
