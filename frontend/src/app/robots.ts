import type { MetadataRoute } from "next";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: ["/graph", "/ask", "/resolve", "/settings", "/login", "/api/"],
      },
    ],
    sitemap: "https://synapse-knowledge.vercel.app/sitemap.xml",
  };
}
