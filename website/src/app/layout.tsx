import type { Metadata } from "next";
import { Inter, Playfair_Display, Space_Grotesk } from "next/font/google";
import "./globals.css";
import Header from "@/components/Header";
import Footer from "@/components/Footer";
import MobileCTA from "@/components/MobileCTA";
import I18nProvider from "@/components/I18nProvider";

const inter = Inter({
  variable: "--font-inter",
  subsets: ["latin"],
});

const playfair = Playfair_Display({
  variable: "--font-playfair",
  weight: ["400", "700", "900"],
  style: ["normal", "italic"],
  subsets: ["latin"],
});

const spaceGrotesk = Space_Grotesk({
  weight: ["400", "500", "600", "700"],
  subsets: ["latin"],
  variable: "--font-logo",
});

const businessName = process.env.NEXT_PUBLIC_BUSINESS_NAME || "Spondic";
const domain = process.env.NEXT_PUBLIC_DOMAIN || "spondic.com";
const siteUrl = `https://${domain}`;

export const metadata: Metadata = {
  metadataBase: new URL(siteUrl),
  icons: {
    icon: "/icon.svg",
  },
  title: `${businessName} — AI-Powered RFP Response Assistant`,
  description:
    "Win more RFPs in hours, not weeks. AI-powered RFP response assistant for enterprise sales teams.",
  keywords: [
    "RFP",
    "request for proposal",
    "RFP response software",
    "AI RFP response",
    "proposal writing software",
    "AI proposal writer",
    "sales enablement",
    "enterprise sales",
    "RFP automation",
    "proposal management software",
    "RFP response tool",
    "AI-powered proposal",
    "knowledge base for proposals",
    "win more RFPs",
  ],
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: businessName,
    title: `${businessName} — AI-Powered RFP Response Assistant`,
    description:
      "Win more RFPs in hours, not weeks. AI-powered RFP response assistant for enterprise sales teams.",
    images: [
      {
        url: "/opengraph-image",
        width: 1200,
        height: 630,
        alt: `${businessName} — AI-Powered RFP Response Assistant`,
      },
    ],
  },
  twitter: {
    card: "summary_large_image",
    title: `${businessName} — AI-Powered RFP Response Assistant`,
    description:
      "Win more RFPs in hours, not weeks. AI-powered RFP response assistant for enterprise sales teams.",
    images: ["/opengraph-image"],
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="en" className={`${inter.variable} ${playfair.variable} ${spaceGrotesk.variable}`}>
      <body className="font-sans antialiased">
        <I18nProvider>
          <div className="min-h-screen bg-cream text-[#141413]">
            <Header />
            {children}
            <Footer />
            <MobileCTA />
          </div>
        </I18nProvider>
      </body>
    </html>
  );
}
