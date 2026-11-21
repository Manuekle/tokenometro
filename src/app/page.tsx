import { Suspense } from "react";
import { CatalogLoading } from "@/components/catalog-loading";
import { JsonLd } from "@/components/json-ld";
import { Workbench } from "@/components/workbench";
import { getCatalog } from "@/lib/catalog/get-catalog";
import { siteUrl, webApplicationLd } from "@/lib/site";

export default function Page() {
  return (
    <>
      <JsonLd data={webApplicationLd(siteUrl())} />
      <Suspense fallback={<CatalogLoading />}>
        <Loaded />
      </Suspense>
    </>
  );
}

async function Loaded() {
  const catalog = await getCatalog();
  return <Workbench catalog={catalog} />;
}
