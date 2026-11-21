import type { MetadataRoute } from "next";
import { homeUrl, siteUrl } from "@/lib/site";

// Prerender this metadata route with Cache Components enabled (Next.js 16.4).
export function generateStaticParams() {
  return [{}];
}

// One page. Prices refresh every hour, so it is worth visiting daily.
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: homeUrl(siteUrl()), changeFrequency: "daily", priority: 1 }];
}
