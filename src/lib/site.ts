/**
 * What the site says about itself. Metadata, JSON-LD, the web manifest and the
 * footer all read from here so they cannot drift apart.
 */
export const SITE = {
  name: "Tokenómetro",
  language: "es",
  /** Open Graph locale: Spanish with no single country. */
  locale: "es_LA",
  title: "Tokenómetro · Contador de tokens y costo de API por modelo",
  description:
    "Compara cuánto cuesta tu texto en cientos de modelos de IA. Cuenta tokens con el tokenizador real de cada uno y proyecta tu gasto mensual de API.",
  keywords: [
    "contador de tokens",
    "calculadora de costos de IA",
    "precios de API de IA",
    "comparar modelos de IA",
    "costo por token",
    "tokenizador",
    "LLM",
    "OpenRouter",
  ],
  /** The app icon's own black: the splash screen of an installed app blends with it. */
  color: "#111111",
} as const;

const FALLBACK_URL = "http://localhost:3000";

/**
 * The public address of the site, for canonical links, Open Graph images and
 * the sitemap. Set NEXT_PUBLIC_SITE_URL in production. On Vercel the production
 * domain is picked up on its own. A value without a protocol gets https.
 */
export function siteUrl(env: Record<string, string | undefined> = process.env): URL {
  const vercel = env.VERCEL_PROJECT_PRODUCTION_URL;
  for (const candidate of [env.NEXT_PUBLIC_SITE_URL, vercel]) {
    const value = candidate?.trim();
    if (!value) continue;
    try {
      return new URL(/^https?:\/\//i.test(value) ? value : `https://${value}`);
    } catch {
      /* not an address: try the next one */
    }
  }
  return new URL(FALLBACK_URL);
}

/** The path the site is served under: "" on a domain of its own, "/tokenometro" on GitHub Pages. */
export const basePath = (url: URL): string => url.pathname.replace(/\/+$/, "");

/** Canonical homepage URL, including the directory slash used by GitHub Pages. */
export const homeUrl = (url: URL): string => new URL(`${basePath(url)}/`, url).href;

/** Structured data for search engines: what this page is, in schema.org terms. */
export function webApplicationLd(url: URL) {
  return {
    "@context": "https://schema.org",
    "@type": "WebApplication",
    name: SITE.name,
    url: homeUrl(url),
    description: SITE.description,
    applicationCategory: "BusinessApplication",
    operatingSystem: "Any",
    browserRequirements: "Requires JavaScript",
    inLanguage: SITE.language,
    isAccessibleForFree: true,
    offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
    featureList: [
      "Cuenta tokens con el tokenizador de cada familia de modelos, en el navegador",
      "Proyecta el costo mensual de la API con tu volumen, caché, Batch y razonamiento",
      "Compara hasta seis modelos lado a lado",
    ],
  };
}
