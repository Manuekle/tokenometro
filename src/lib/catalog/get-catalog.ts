import { cacheLife } from "next/cache";
import { getCatalog as loadCatalog } from "./load-catalog";
import type { Catalog } from "./types";

/** Cache the catalog on a Next.js server. The static build calls the loader directly. */
export async function getCatalog(): Promise<Catalog> {
  "use cache";

  const catalog = await loadCatalog();
  cacheLife(
    catalog.source === "live"
      ? { stale: 300, revalidate: 3600, expire: 86400 }
      : { stale: 60, revalidate: 120, expire: 600 },
  );
  return catalog;
}
