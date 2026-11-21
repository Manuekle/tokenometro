"use client";

import { Switch } from "@/components/ui/switch";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Label } from "@/components/ui/label";
import { Group, NumberField, SliderField, Step } from "@/components/field";
import type { Period, WorkloadState } from "@/lib/app-state";

interface Props {
  workload: WorkloadState;
  onChange: (patch: Partial<WorkloadState>) => void;
  /** An output sample exists, so the manual output tokens are ignored. */
  hasOutputSample: boolean;
}

export function WorkloadPanel({ workload: w, onChange, hasOutputSample }: Props) {
  return (
    <Step n={2} title="Tu carga de trabajo">
      <Group title="Volumen y tamaño">
        <div className="grid grid-cols-[1fr_auto] items-end gap-2">
          <NumberField
            label="Solicitudes"
            value={w.requests}
            min={0}
            onChange={(requests) => onChange({ requests })}
          />
          <Select value={w.period} onValueChange={(v) => onChange({ period: v as Period })}>
            <SelectTrigger className="w-[112px]" aria-label="Periodo">
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">por mes</SelectItem>
              <SelectItem value="day">por día</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <NumberField
            label="Tokens de salida"
            value={w.outputTokens}
            onChange={(outputTokens) => onChange({ outputTokens })}
            disabled={hasOutputSample}
            hint={hasOutputSample ? "Se usa tu respuesta típica." : undefined}
          />
          <NumberField
            label="Prefijo fijo"
            value={w.fixedInputTokens}
            onChange={(fixedInputTokens) => onChange({ fixedInputTokens })}
            hint="System prompt, reglas y herramientas."
          />
        </div>

        <NumberField
          label="Veces que se repite tu texto por solicitud"
          value={w.sampleCopies}
          min={1}
          max={1000}
          onChange={(sampleCopies) => onChange({ sampleCopies })}
          hint="Ej. 5 fragmentos de documentos en una consulta RAG."
        />
      </Group>

      <Group title="Ahorros">
        <SliderField
          label="Aciertos de caché del prefijo"
          value={w.cacheHitRate}
          onChange={(cacheHitRate) => onChange({ cacheHitRate })}
          hint="Solicitudes que encuentran el prefijo ya cacheado. Leer caché cuesta una fracción."
        />
        <SliderField
          label="Parte de tu texto que se repite"
          value={w.sampleReusePct}
          onChange={(sampleReusePct) => onChange({ sampleReusePct })}
          hint="Si varias solicitudes comparten el mismo documento, también se cachea."
        />
        <SliderField
          label="Tráfico por Batch API"
          value={w.batchShare}
          onChange={(batchShare) => onChange({ batchShare })}
          hint="Proceso asíncrono con descuento. Solo en modelos que lo ofrecen."
        />
      </Group>

      <Group title="Razonamiento">
        <NumberField
          label="Tokens de razonamiento extra"
          value={w.reasoningTokens}
          onChange={(reasoningTokens) => onChange({ reasoningTokens })}
          hint="Los modelos que razonan cobran su «pensamiento» como salida. Lo ves en usage.reasoning_tokens."
        />
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="reason-optional" className="text-xs leading-snug font-medium">
            Aplicar también donde el razonamiento es opcional
          </Label>
          <Switch
            id="reason-optional"
            checked={w.reasoningOnOptional}
            onCheckedChange={(reasoningOnOptional) => onChange({ reasoningOnOptional })}
          />
        </div>
      </Group>
    </Step>
  );
}
