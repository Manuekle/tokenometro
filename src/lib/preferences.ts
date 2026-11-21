export type Language = "es" | "en";
export type Theme = "light" | "dark";

export interface Preferences {
  language: Language;
  /** No explicit choice: follow the operating system. */
  theme: Theme | null;
}

export const PREFERENCES_KEY = "tokenometro:preferences:v1";
export const DEFAULT_PREFERENCES: Preferences = { language: "es", theme: null };

export function parsePreferences(raw: string | null): Preferences {
  try {
    const value: unknown = JSON.parse(raw ?? "null");
    if (!value || typeof value !== "object") return DEFAULT_PREFERENCES;
    const saved = value as Record<string, unknown>;
    return {
      language: saved.language === "en" ? "en" : "es",
      theme: saved.theme === "light" || saved.theme === "dark" ? saved.theme : null,
    };
  } catch {
    return DEFAULT_PREFERENCES;
  }
}

/** Runs in <head> before paint. Only a validated theme can reach the document. */
export const themeBootstrap = `try{var p=JSON.parse(localStorage.getItem(${JSON.stringify(PREFERENCES_KEY)})||"null");if(p&&(p.theme==="light"||p.theme==="dark")){document.documentElement.dataset.theme=p.theme}}catch{}`;
