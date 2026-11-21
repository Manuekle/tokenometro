import { describe, expect, it } from "vitest";
import { SITE, basePath, homeUrl, siteUrl, webApplicationLd } from "./site";

describe("basePath", () => {
  it("is empty on a domain of its own and the repo path on GitHub Pages", () => {
    expect(basePath(new URL("https://tokenometro.example"))).toBe("");
    expect(basePath(new URL("https://tokenometro.example/"))).toBe("");
    expect(basePath(new URL("https://manuekle.github.io/tokenometro"))).toBe("/tokenometro");
    expect(basePath(new URL("https://manuekle.github.io/tokenometro/"))).toBe("/tokenometro");
  });
});

describe("siteUrl", () => {
  it("falls back to localhost when nothing is configured", () => {
    expect(siteUrl({}).origin).toBe("http://localhost:3000");
  });

  it("prefers NEXT_PUBLIC_SITE_URL over the Vercel production domain", () => {
    const env = { NEXT_PUBLIC_SITE_URL: "https://tokenometro.example", VERCEL_PROJECT_PRODUCTION_URL: "x.vercel.app" };
    expect(siteUrl(env).origin).toBe("https://tokenometro.example");
  });

  it("picks up the Vercel production domain, which comes without a protocol", () => {
    expect(siteUrl({ VERCEL_PROJECT_PRODUCTION_URL: "tokenometro.vercel.app" }).origin).toBe(
      "https://tokenometro.vercel.app",
    );
  });

  it("adds https to a bare domain and trims stray spaces", () => {
    expect(siteUrl({ NEXT_PUBLIC_SITE_URL: "  tokenometro.example  " }).origin).toBe("https://tokenometro.example");
  });

  it("skips values that are not an address instead of crashing the build", () => {
    expect(siteUrl({ NEXT_PUBLIC_SITE_URL: "not a url", VERCEL_PROJECT_PRODUCTION_URL: "ok.example" }).origin).toBe(
      "https://ok.example",
    );
    expect(siteUrl({ NEXT_PUBLIC_SITE_URL: "javascript:alert(1)" }).origin).toBe("http://localhost:3000");
    expect(siteUrl({ NEXT_PUBLIC_SITE_URL: "" }).origin).toBe("http://localhost:3000");
  });
});

describe("homeUrl", () => {
  it("drops the trailing slash, as the canonical link does", () => {
    expect(homeUrl(new URL("https://tokenometro.example"))).toBe("https://tokenometro.example");
    expect(homeUrl(new URL("https://tokenometro.example/"))).toBe("https://tokenometro.example");
  });

  it("keeps a base path", () => {
    expect(homeUrl(new URL("https://example.com/start/here/"))).toBe("https://example.com/start/here");
  });
});

describe("site copy", () => {
  it("fits what a search result shows", () => {
    expect(SITE.title.length).toBeLessThanOrEqual(65);
    expect(SITE.description.length).toBeLessThanOrEqual(160);
  });
});

describe("webApplicationLd", () => {
  const ld = webApplicationLd(new URL("https://tokenometro.example"));

  it("describes a free web application at the site's address", () => {
    expect(ld["@type"]).toBe("WebApplication");
    expect(ld.url).toBe("https://tokenometro.example");
    expect(ld.isAccessibleForFree).toBe(true);
    expect(ld.offers.price).toBe("0");
    expect(ld.inLanguage).toBe("es");
  });

  it("round-trips through JSON, as it is embedded in the page", () => {
    expect(JSON.parse(JSON.stringify(ld))).toEqual(ld);
  });
});
