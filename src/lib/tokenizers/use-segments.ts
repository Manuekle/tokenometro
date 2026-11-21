"use client";

import { useEffect, useRef, useState } from "react";
import type { TokenizerId } from "./registry";

type Segmented = Partial<Record<TokenizerId, { excerpt: string; pieces: string[] }>>;

/**
 * Cuts `excerpt` into tokens with each ready engine, for the ribbon.
 * Only the first few hundred characters are ever sent: this is a preview.
 */
export function useSegments(
  segment: (id: TokenizerId, text: string) => Promise<string[]>,
  excerpt: string,
  ids: TokenizerId[],
): Segmented {
  const [segmented, setSegmented] = useState<Segmented>({});
  const known = useRef<Segmented>({});
  const key = ids.join(",");

  useEffect(() => {
    if (!excerpt) return;
    let cancelled = false;
    for (const id of key ? (key.split(",") as TokenizerId[]) : []) {
      if (known.current[id]?.excerpt === excerpt) continue;
      segment(id, excerpt)
        .then((pieces) => {
          if (cancelled) return;
          known.current = { ...known.current, [id]: { excerpt, pieces } };
          setSegmented(known.current);
        })
        .catch(() => undefined);
    }
    return () => {
      cancelled = true;
    };
  }, [segment, excerpt, key]);

  return segmented;
}
