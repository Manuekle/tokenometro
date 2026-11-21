import type { NextConfig } from "next";

// GitHub Pages serves static files only, under /<repo>/. The workflow switches both on at build time
// (NEXT_OUTPUT=export, and NEXT_PUBLIC_SITE_URL=https://<user>.github.io/<repo>), so `next dev` and a
// plain `next build` behave as before. The base path is the path of the public address.
const sitePath = (() => {
  try {
    return new URL(process.env.NEXT_PUBLIC_SITE_URL ?? "").pathname.replace(/\/+$/, "");
  } catch {
    return "";
  }
})();

const nextConfig: NextConfig = {
  ...(process.env.NEXT_OUTPUT === "export" && {
    output: "export" as const,
    images: { unoptimized: true }, // the default image loader needs a server
  }),
  ...(sitePath && { basePath: sitePath }),
  cacheComponents: true,
  partialPrefetching: true,
  turbopack: {
    rules: {
      "*.css": {
        loaders: ["@tailwindcss/turbopack"],
        as: "*.css",
      },
    },
  },
};

export default nextConfig;
