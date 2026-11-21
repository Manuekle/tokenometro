"use client";

import { cn } from "cn";
import { usePreferences } from "@/components/preferences-provider";
import { Sym } from "@/components/sym";

const choice = (selected: boolean) =>
  cn(
    "inline-flex min-h-10 items-center justify-center gap-2 rounded-full px-4 text-sm font-semibold outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45",
    selected
      ? "bg-raise text-foreground shadow-raise"
      : "text-muted-foreground hover:bg-raise/50 hover:text-foreground",
  );

export function FooterPreferences() {
  const { language, theme, setLanguage, setTheme, t } = usePreferences();
  return (
    <div className="flex flex-wrap gap-x-8 gap-y-5 lg:col-span-full">
      <fieldset className="min-w-0">
        <legend className="role-label mb-2.5 text-muted-foreground">{t("Tema")}</legend>
        <div className="inline-flex max-w-full rounded-full bg-secondary p-1">
          <button
            type="button"
            aria-pressed={theme === "light"}
            className={choice(theme === "light")}
            onClick={() => setTheme("light")}
          >
            <Sym>☀</Sym> {t("Claro")}
          </button>
          <button
            type="button"
            aria-pressed={theme === "dark"}
            className={choice(theme === "dark")}
            onClick={() => setTheme("dark")}
          >
            <Sym>☾</Sym> {t("Oscuro")}
          </button>
        </div>
      </fieldset>
      <fieldset className="min-w-0">
        <legend className="role-label mb-2.5 text-muted-foreground">{t("Idioma")}</legend>
        <div className="inline-flex max-w-full rounded-full bg-secondary p-1">
          <button
            type="button"
            lang="es"
            aria-pressed={language === "es"}
            className={choice(language === "es")}
            onClick={() => setLanguage("es")}
          >
            Español
          </button>
          <button
            type="button"
            lang="en"
            aria-pressed={language === "en"}
            className={choice(language === "en")}
            onClick={() => setLanguage("en")}
          >
            English
          </button>
        </div>
      </fieldset>
    </div>
  );
}
