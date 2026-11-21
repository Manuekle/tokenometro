"use client";

import { usePreferences } from "@/components/preferences-provider";

export function CatalogLoading() {
  const { t } = usePreferences();
  return (
    <p className="grid flex-1 place-items-center py-32 text-sm text-muted-foreground" role="status">
      {t("Cargando el catálogo de modelos…")}
    </p>
  );
}
