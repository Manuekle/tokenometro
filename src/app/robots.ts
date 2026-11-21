import type { MetadataRoute } from "next";
import { siteUrl } from "@/lib/site";

// Prerender this metadata route with Cache Components enabled (Next.js 16.4).
export function generateStaticParams() {
  return [{}];
}

export default function robots(): MetadataRoute.Robots {
  return {
    rules: { userAgent: "*", allow: "/" },
    sitemap: new URL(`${siteUrl().pathname.replace(/\/$/, "")}/sitemap.xml`, siteUrl()).toString(),
  };
}
