"use client";

import { usePreferences } from "@/components/preferences-provider";
import { Sym } from "@/components/sym";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogBody,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";

function Block({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="grid gap-1.5">
      <h3 className="role-title text-base">{title}</h3>
      <div className="grid gap-2 text-sm leading-relaxed text-muted-foreground [&_strong]:font-semibold [&_strong]:text-foreground">
        {children}
      </div>
    </section>
  );
}

export function MethodologyDialog() {
  const { t } = usePreferences();
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm">
          {t("Cómo se calcula ")}
          <Sym>→</Sym>
        </Button>
      </DialogTrigger>
      <DialogContent className="sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl [font-variation-settings:'ROND'_100]">{t("Cómo se calcula")}</DialogTitle>
          <DialogDescription>
            {t("De dónde salen los precios, cómo se cuentan los tokens y qué no cubre esta herramienta.")}
          </DialogDescription>
        </DialogHeader>

        <DialogBody className="grid gap-6">
          <Block title={t("Precios y modelos")}>
            <p>
              {t("Vienen de la API pública de ")}
              <strong>OpenRouter</strong> (<code className="num">/api/v1/models</code>
              {t("), sin clave, y se refrescan cada seis horas. Son ")}
              <strong>{t("precios de lista por token")}</strong>{" "}
              {t(
                " de cada proveedor, incluida la lectura y escritura de caché, el descuento de Batch y los recargos por contexto largo. Si la API falla se usa una copia local.",
              )}
            </p>
            <p>
              {t("Para contrastar: models.dev, el endpoint ")}
              <code className="num">/v1/models</code>{" "}
              {t(" de Vercel AI Gateway y la tabla de LiteLLM publican los mismos precios de lista.")}
            </p>
            <p>
              {t("El ")}
              <strong>{t("índice de inteligencia")}</strong>{" "}
              {t(
                " es el de Artificial Analysis, que OpenRouter incluye para parte de los modelos. Mide tareas generales. Valida con tus propios casos antes de decidir.",
              )}
            </p>
          </Block>

          <Block title={t("Cómo se cuentan los tokens")}>
            <p>
              {t("Tu texto se cuenta en el navegador, nunca sale de él. Cada modelo usa el tokenizador de su familia:")}
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>
                <strong>{t("Exacto")}</strong>
                {t(
                  ": OpenAI (o200k, cl100k) y los modelos abiertos Qwen, DeepSeek, Mistral, Llama y Gemma. Los de Hugging Face se descargan una vez (≈100 MB) y se guardan en el navegador. Para versiones muy nuevas el tokenizador de la familia puede variar unos puntos.",
                )}
              </li>
              <li>
                <strong>{t("Aproximado")}</strong>
                {t(": Gemini, con el tokenizador de Gemma, de la misma línea.")}
              </li>
              <li>
                <strong>{t("Estimado")}</strong>
                {t(
                  ": Claude, Grok y otros que no publican su tokenizador. Se parte del conteo de OpenAI con un factor. Puedes calibrar Claude y Gemini con la API gratuita de conteo de cada proveedor.",
                )}
              </li>
            </ul>
          </Block>

          <Block title={t("Cómo se calcula el costo")}>
            <p>
              {t("Por solicitud: ")}
              <strong>{t("entrada nueva")}</strong> {t(" × tarifa de entrada + ")}
              <strong>{t("prefijo cacheable")}</strong>{" "}
              {t(" × (aciertos × tarifa de lectura + fallos × tarifa de escritura) + ")}
              <strong>{t("salida")}</strong> {t(" × tarifa de salida +")} <strong>{t("razonamiento")}</strong>{" "}
              {t(" × tarifa de salida. Se multiplica por las solicitudes al mes.")}
            </p>
            <ul className="list-disc space-y-1 pl-5">
              <li>{t("Si el prompt supera el umbral de contexto largo de un modelo, se usa su tarifa de recargo.")}</li>
              <li>
                {t("El tráfico por Batch usa la tarifa Batch del modelo, solo si la ofrece. Si no, se cobra normal.")}
              </li>
              <li>{t("El prefijo en caché solo se descuenta en modelos con precio de lectura de caché.")}</li>
              <li>{t("Un mes son 30 días.")}</li>
            </ul>
          </Block>

          <Block title={t("Lo que no incluye")}>
            <ul className="list-disc space-y-1 pl-5">
              <li>{t("Descuentos por volumen, contratos empresariales, impuestos ni tipo de cambio.")}</li>
              <li>{t("Imágenes, audio, video ni PDF como entrada: solo texto.")}</li>
              <li>
                {t("Modelos abiertos: se usa el precio de OpenRouter. Alojarlos tú tiene otro costo (GPU, operación).")}
              </li>
              <li>{t("La latencia, los límites de tasa y la calidad en tu tarea concreta.")}</li>
            </ul>
          </Block>
        </DialogBody>
      </DialogContent>
    </Dialog>
  );
}
