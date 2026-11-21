import type { Metadata, Viewport } from "next";
import "allo-font"; // the variable font (wght, ROND, opsz) and its obliques
import { PreferencesProvider } from "@/components/preferences-provider";
import { themeBootstrap } from "@/lib/preferences";
import { SiteFooter } from "@/components/site-footer";
import { TooltipProvider } from "@/components/ui/tooltip";
import { SEO, SITE, homeUrl, siteUrl } from "@/lib/site";
import "./globals.css";

const publicUrl = siteUrl();
const canonical = homeUrl(publicUrl);

// The icons, the Open Graph image, robots.txt, the sitemap and the web manifest
// come from the files next to this one (icon.png, opengraph-image.png, robots.ts…).
export const metadata: Metadata = {
  // Next.js already adds basePath to file-based metadata such as the social image.
  metadataBase: new URL(publicUrl.origin),
  title: { default: SEO.title, template: `%s · ${SITE.name}` },
  description: SEO.description,
  applicationName: SITE.name,
  // The label under the icon when someone adds the site to their iPhone's home screen.
  appleWebApp: { title: SITE.name },
  keywords: [...SEO.keywords, ...SITE.keywords],
  category: "technology",
  alternates: { canonical },
  openGraph: {
    type: "website",
    url: canonical,
    siteName: SITE.name,
    locale: SEO.locale,
    alternateLocale: [SITE.locale],
    title: SEO.title,
    description: SEO.description,
  },
  twitter: {
    card: "summary_large_image",
    title: SEO.title,
    description: SEO.description,
  },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
    },
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
    <html lang="es" className="h-full" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeBootstrap }} />
      </head>
      <body className="flex min-h-full flex-col">
        <PreferencesProvider>
          <TooltipProvider delayDuration={150}>{children}</TooltipProvider>
          <SiteFooter />
        </PreferencesProvider>
      </body>
    </html>
  );
}
