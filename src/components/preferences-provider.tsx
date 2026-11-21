"use client";

import { createContext, useCallback, useContext, useEffect, useMemo, useState, useSyncExternalStore } from "react";
import { translate, translateError, type MessageValues } from "@/lib/i18n";
import {
  DEFAULT_PREFERENCES,
  PREFERENCES_KEY,
  parsePreferences,
  type Language,
  type Preferences,
  type Theme,
} from "@/lib/preferences";

interface PreferencesContextValue {
  language: Language;
  theme: Theme;
  setLanguage: (language: Language) => void;
  setTheme: (theme: Theme) => void;
  t: (message: string, values?: MessageValues) => string;
  tError: (message: string) => string;
}

const PreferencesContext = createContext<PreferencesContextValue | null>(null);
const darkQuery = "(prefers-color-scheme: dark)";
const subscribeSystem = (onChange: () => void) => {
  const query = window.matchMedia(darkQuery);
  query.addEventListener("change", onChange);
  return () => query.removeEventListener("change", onChange);
};
const systemDark = () => window.matchMedia(darkQuery).matches;
const serverDark = () => false;

export function PreferencesProvider({ children }: { children: React.ReactNode }) {
  const [preferences, setPreferences] = useState<Preferences>(DEFAULT_PREFERENCES);
  const [restored, setRestored] = useState(false);
  const prefersDark = useSyncExternalStore(subscribeSystem, systemDark, serverDark);
  const theme = preferences.theme ?? (prefersDark ? "dark" : "light");

  useEffect(() => {
    const restore = () => {
      try {
        setPreferences(parsePreferences(localStorage.getItem(PREFERENCES_KEY)));
      } catch {
        // Storage can be blocked. Keep the in-memory preference usable.
      }
    };
    // Saved preferences can only be restored after hydration; the head script already applied the theme.
    restore();
    // eslint-disable-next-line react-hooks/set-state-in-effect
    setRestored(true);
    const sync = (event: StorageEvent) => {
      if (event.key === PREFERENCES_KEY || event.key === null) restore();
    };
    window.addEventListener("storage", sync);
    return () => window.removeEventListener("storage", sync);
  }, []);

  const { language } = preferences;
  const t = useCallback((message: string, values?: MessageValues) => translate(language, message, values), [language]);
  const tError = useCallback((message: string) => translateError(language, message), [language]);

  useEffect(() => {
    document.documentElement.lang = language;
  }, [language]);

  useEffect(() => {
    if (!restored) return;
    if (preferences.theme) document.documentElement.dataset.theme = preferences.theme;
    else delete document.documentElement.dataset.theme;
  }, [preferences.theme, restored]);

  const update = useCallback((patch: Partial<Preferences>) => {
    setPreferences((previous) => ({ ...previous, ...patch }));
  }, []);

  // Persist after updates, but never replace stored preferences with the server defaults on mount.
  const setLanguage = useCallback(
    (next: Language) => {
      update({ language: next });
      try {
        const saved = parsePreferences(localStorage.getItem(PREFERENCES_KEY));
        localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ ...saved, language: next }));
      } catch {
        /* Session-only preferences still work. */
      }
    },
    [update],
  );
  const setTheme = useCallback(
    (next: Theme) => {
      update({ theme: next });
      document.documentElement.dataset.theme = next;
      try {
        const saved = parsePreferences(localStorage.getItem(PREFERENCES_KEY));
        localStorage.setItem(PREFERENCES_KEY, JSON.stringify({ ...saved, theme: next }));
      } catch {
        /* Session-only preferences still work. */
      }
    },
    [update],
  );

  const value = useMemo(
    () => ({ language, theme, setLanguage, setTheme, t, tError }),
    [language, theme, setLanguage, setTheme, t, tError],
  );
  return <PreferencesContext value={value}>{children}</PreferencesContext>;
}

export function usePreferences(): PreferencesContextValue {
  const value = useContext(PreferencesContext);
  if (!value) throw new Error("usePreferences must be used within PreferencesProvider");
  return value;
}
