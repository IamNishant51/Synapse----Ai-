import type { Metadata } from "next";
import { Inter, EB_Garamond } from "next/font/google";
import LayoutWrapper from "@/components/LayoutWrapper";
import "./globals.css";

const inter = Inter({
  subsets: ["latin"],
  variable: "--font-inter",
  weight: ["400", "500", "600"],
});
const garamond = EB_Garamond({
  subsets: ["latin"],
  variable: "--font-display",
  weight: ["400", "500"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://synapse-knowledge.vercel.app"),
  title: "Synapse — A memory that knows when to update itself",
  description: "A self-organizing personal knowledge graph that ingests everything you read, write, and build — and actively maintains itself.",
  manifest: "/site.webmanifest",
  icons: {
    icon: [
      { url: "/favicon-16x16.png", sizes: "16x16", type: "image/png" },
      { url: "/favicon-32x32.png", sizes: "32x32", type: "image/png" },
    ],
    apple: "/apple-touch-icon.png",
    shortcut: "/favicon.ico",
  },
  openGraph: {
    title: "Synapse — A memory that knows when to update itself",
    description: "A self-organizing personal knowledge graph built on Cognee's memory lifecycle.",
    url: "https://synapse-knowledge.vercel.app",
    siteName: "Synapse",
    images: [
      {
        url: "/images/og-image.png",
        width: 1200,
        height: 630,
        alt: "Synapse Metadata Graph and memory visualization",
      },
    ],
    type: "website",
  },
  twitter: {
    card: "summary_large_image",
    title: "Synapse — A memory that knows when to update itself",
    description: "A self-organizing personal knowledge graph built on Cognee's memory lifecycle.",
    images: ["/images/og-image.png"],
  },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html
      lang="en"
      className={`${inter.variable} ${garamond.variable} h-full antialiased`}
    >
      <body className="h-full bg-canvas text-ink">
        <LayoutWrapper>{children}</LayoutWrapper>
      </body>
    </html>
  );
}
