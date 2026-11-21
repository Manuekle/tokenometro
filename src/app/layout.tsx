import type { Metadata, Viewport } from "next";
import "allo-font"; // the variable font (wght, ROND, opsz) and its obliques
import { SiteFooter } from "@/components/site-footer";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SITE, siteUrl } from "@/lib/site";
import "./globals.css";

// The icons, the Open Graph image, robots.txt, the sitemap and the web manifest
// come from the files next to this one (icon.png, opengraph-image.png, robots.ts…).
export const metadata: Metadata = {
  metadataBase: siteUrl(),
  title: { default: SITE.title, template: `%s · ${SITE.name}` },
  description: SITE.description,
  applicationName: SITE.name,
  // The label under the icon when someone adds the site to their iPhone's home screen.
  appleWebApp: { title: SITE.name },
  keywords: [...SITE.keywords],
  category: "technology",
  alternates: { canonical: "/" },
  openGraph: {
    type: "website",
    url: "/",
    siteName: SITE.name,
    locale: SITE.locale,
    title: SITE.title,
    description: SITE.description,
  },
  twitter: {
    card: "summary_large_image",
    title: SITE.title,
    description: SITE.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: { index: true, follow: true, "max-image-preview": "large", "max-snippet": -1 },
  },
};

export const viewport: Viewport = {
  colorScheme: "light dark",
  themeColor: [
    { media: "(prefers-color-scheme: light)", color: "#fcfcfc" },
    { media: "(prefers-color-scheme: dark)", color: "#111111" },
  ],
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="es" className="h-full">
      <body className="flex min-h-full flex-col">
        <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
        <SiteFooter />
      </body>
    </html>
  );
}
