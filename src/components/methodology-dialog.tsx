"use client";

import { Sym } from "@/components/sym";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
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
  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button size="sm">
          Cómo se calcula <Sym>→</Sym>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[88vh] gap-6 overflow-y-auto sm:max-w-2xl">
        <DialogHeader>
          <DialogTitle className="text-2xl [font-variation-settings:'ROND'_100]">Cómo se calcula</DialogTitle>
          <DialogDescription>
            De dónde salen los precios, cómo se cuentan los tokens y qué no cubre esta herramienta.
          </DialogDescription>
        </DialogHeader>

        <Block title="Precios y modelos">
          <p>
            Vienen de la API pública de <strong>OpenRouter</strong> (<code className="num">/api/v1/models</code>), sin
            clave, y se refrescan cada hora. Son <strong>precios de lista por token</strong> de cada proveedor, incluida la
            lectura y escritura de caché, el descuento de Batch y los recargos por contexto largo. Si la API falla se usa
            una copia local.
          </p>
          <p>
            Para contrastar: models.dev, el endpoint <code className="num">/v1/models</code> de Vercel AI Gateway y la
            tabla de LiteLLM publican los mismos precios de lista.
          </p>
          <p>
            El <strong>índice de inteligencia</strong> es el de Artificial Analysis, que OpenRouter incluye para parte de
            los modelos. Mide tareas generales. Valida con tus propios casos antes de decidir.
          </p>
        </Block>

        <Block title="Cómo se cuentan los tokens">
          <p>
            Tu texto se cuenta en el navegador, nunca sale de él. Cada modelo usa el tokenizador de su familia:
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>
              <strong>Exacto</strong>: OpenAI (o200k, cl100k) y los modelos abiertos Qwen, DeepSeek, Mistral, Llama y
              Gemma. Los de Hugging Face se descargan una vez (≈100 MB) y se guardan en el navegador. Para versiones
              muy nuevas el tokenizador de la familia puede variar unos puntos.
            </li>
            <li>
              <strong>Aproximado</strong>: Gemini, con el tokenizador de Gemma, de la misma línea.
            </li>
            <li>
              <strong>Estimado</strong>: Claude, Grok y otros que no publican su tokenizador. Se parte del conteo de OpenAI
              con un factor. Puedes calibrar Claude y Gemini con la API gratuita de conteo de cada proveedor.
            </li>
          </ul>
        </Block>

        <Block title="Cómo se calcula el costo">
          <p>
            Por solicitud: <strong>entrada nueva</strong> × tarifa de entrada + <strong>prefijo cacheable</strong> × (aciertos
            × tarifa de lectura + fallos × tarifa de escritura) + <strong>salida</strong> × tarifa de salida +{" "}
            <strong>razonamiento</strong> × tarifa de salida. Se multiplica por las solicitudes al mes.
          </p>
          <ul className="list-disc space-y-1 pl-5">
            <li>Si el prompt supera el umbral de contexto largo de un modelo, se usa su tarifa de recargo.</li>
            <li>
              El tráfico por Batch usa la tarifa Batch del modelo, solo si la ofrece. Si no, se cobra normal.
            </li>
            <li>El prefijo en caché solo se descuenta en modelos con precio de lectura de caché.</li>
            <li>Un mes son 30 días.</li>
          </ul>
        </Block>

        <Block title="Lo que no incluye">
          <ul className="list-disc space-y-1 pl-5">
            <li>Descuentos por volumen, contratos empresariales, impuestos ni tipo de cambio.</li>
            <li>Imágenes, audio, video ni PDF como entrada: solo texto.</li>
            <li>
              Modelos abiertos: se usa el precio de OpenRouter. Alojarlos tú tiene otro costo (GPU, operación).
            </li>
            <li>La latencia, los límites de tasa y la calidad en tu tarea concreta.</li>
          </ul>
        </Block>
      </DialogContent>
    </Dialog>
  );
}
