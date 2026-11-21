import { Suspense } from "react";
import { JsonLd } from "@/components/json-ld";
import { Workbench } from "@/components/workbench";
import { getCatalog } from "@/lib/catalog/get-catalog";
import { siteUrl, webApplicationLd } from "@/lib/site";

export default function Page() {
  return (
    <>
      <JsonLd data={webApplicationLd(siteUrl())} />
      <Suspense
        fallback={
          <p className="grid flex-1 place-items-center py-32 text-sm text-muted-foreground" role="status">
            Cargando el catálogo de modelos…
          </p>
        }
      >
        <Loaded />
      </Suspense>
    </>
  );
}

async function Loaded() {
  const catalog = await getCatalog();
  return <Workbench catalog={catalog} />;
}
