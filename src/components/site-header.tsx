"use client";

import { usePreferences } from "@/components/preferences-provider";
import { useEffect, useState } from "react";
import { cn } from "cn";
import { MethodologyDialog } from "@/components/methodology-dialog";
import { Sym } from "@/components/sym";
import type { Language } from "@/lib/preferences";
import { timeAgo } from "@/lib/format";

const MONTHS = {
  es: ["ene", "feb", "mar", "abr", "may", "jun", "jul", "ago", "sep", "oct", "nov", "dic"],
  en: ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"],
};

/** Deterministic (UTC, hand-built) so server and client render the same text. */
function utcStamp(iso: string, language: Language): string {
  const d = new Date(iso);
  const hh = String(d.getUTCHours()).padStart(2, "0");
  const mm = String(d.getUTCMinutes()).padStart(2, "0");
  return `${d.getUTCDate()} ${MONTHS[language][d.getUTCMonth()]} ${hh}:${mm} UTC`;
}

interface Props {
  source: "live" | "snapshot";
  fetchedAt: string;
  modelCount: number;
}

export function SiteHeader({ source, fetchedAt, modelCount }: Props) {
  const { t, language } = usePreferences();
  const [now, setNow] = useState<number | null>(null);
  useEffect(() => {
    const tick = () => setNow(Date.now());
    tick();
    const id = setInterval(tick, 60_000);
    return () => clearInterval(id);
  }, []);

  return (
    <header className="flex flex-wrap items-center justify-between gap-x-6 gap-y-3 py-6">
      <p className="role-display text-[24px] leading-none">
        Tokenómetro<span className="text-blue">.</span>
      </p>
      <div className="flex flex-wrap items-center gap-x-5 gap-y-3">
        <p className="flex items-center gap-2 text-xs text-muted-foreground" role="status">
          <Sym className={cn("text-[10px]", source === "live" ? "text-green" : "text-orange")}>●</Sym>
          <span>
            <span className="num font-semibold text-foreground">{modelCount}</span> {t(" modelos ·")}{" "}
            {source === "live" ? t("precios de OpenRouter") : t("copia local de precios")} ·{" "}
            <time dateTime={fetchedAt}>{now ? timeAgo(fetchedAt, now, language) : utcStamp(fetchedAt, language)}</time>
          </span>
        </p>
        <MethodologyDialog />
      </div>
    </header>
  );
}
