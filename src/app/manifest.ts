import type { MetadataRoute } from "next";
import { SITE, basePath, siteUrl } from "@/lib/site";

// Prerender this metadata route with Cache Components enabled (Next.js 16.4).
export function generateStaticParams() {
  return [{}];
}

export default function manifest(): MetadataRoute.Manifest {
  // On GitHub Pages the site lives under /<repo>/, and these paths are not rewritten for us.
  const base = basePath(siteUrl());
  return {
    id: `${base}/`,
    name: SITE.name,
    short_name: SITE.name,
    description: SITE.description,
    start_url: `${base}/`,
    scope: `${base}/`,
    display: "standalone",
    lang: SITE.language,
    categories: ["productivity", "utilities", "business"],
    background_color: SITE.color,
    theme_color: SITE.color,
    icons: [
      { src: `${base}/icons/icon-192.png`, sizes: "192x192", type: "image/png", purpose: "any" },
      { src: `${base}/icons/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "any" },
      // The mark sits well inside the safe zone, so the same artwork works masked.
      { src: `${base}/icons/icon-512.png`, sizes: "512x512", type: "image/png", purpose: "maskable" },
    ],
  };
}
