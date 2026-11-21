import type { MetadataRoute } from "next";
import { homeUrl, siteUrl } from "@/lib/site";

export const dynamic = "force-static";

// One page. Prices refresh every hour, so it is worth visiting daily.
export default function sitemap(): MetadataRoute.Sitemap {
  return [{ url: homeUrl(siteUrl()), changeFrequency: "daily", priority: 1 }];
}
