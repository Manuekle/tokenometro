import { runInNewContext } from "node:vm";
import { describe, expect, it } from "vitest";
import { DEFAULT_PREFERENCES, PREFERENCES_KEY, parsePreferences, themeBootstrap } from "./preferences";

describe("saved preferences", () => {
  it("restores only supported language and theme values", () => {
    expect(parsePreferences('{"language":"en","theme":"dark"}')).toEqual({
      language: "en",
      theme: "dark",
    });
    expect(parsePreferences('{"language":"es","theme":"light"}')).toEqual({
      language: "es",
      theme: "light",
    });
    expect(parsePreferences('{"language":"en"}')).toEqual({
      language: "en",
      theme: null,
    });
  });

  it("falls back to Spanish and the system theme for missing, corrupt or unsupported preferences", () => {
    for (const raw of [null, "bad json", "null", "42", '"en"', '{"language":"fr","theme":"sepia"}']) {
      expect(parsePreferences(raw)).toEqual(DEFAULT_PREFERENCES);
    }
  });
});

describe("theme before first paint", () => {
  function boot(raw: string | null, blocked = false) {
    const dataset: Record<string, string> = {};
    runInNewContext(themeBootstrap, {
      document: { documentElement: { dataset } },
      localStorage: {
        getItem: (key: string) => {
          expect(key).toBe(PREFERENCES_KEY);
          if (blocked) throw new Error("Storage blocked");
          return raw;
        },
      },
    });
    return dataset;
  }

  it("restores an explicit theme without needing React or a server", () => {
    expect(boot('{"theme":"dark"}')).toEqual({ theme: "dark" });
    expect(boot('{"theme":"light"}')).toEqual({ theme: "light" });
  });

  it("leaves CSS in control when there is no valid theme or storage access", () => {
    expect(boot(null)).toEqual({});
    expect(boot("corrupt")).toEqual({});
    expect(boot('{"theme":"anything"}')).toEqual({});
    expect(boot(null, true)).toEqual({});
  });
});
