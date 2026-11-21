"use client";

import { usePreferences } from "@/components/preferences-provider";
import { Switch } from "@/components/ui/switch";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
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
  const { t } = usePreferences();
  return (
    <Step n={2} title={t("Tu carga de trabajo")}>
      <Group title={t("Volumen y tamaño")}>
        <div className="grid grid-cols-[minmax(0,1fr)_auto] items-end gap-2">
          <NumberField
            label={t("Solicitudes")}
            value={w.requests}
            min={0}
            onChange={(requests) => onChange({ requests })}
          />
          <Select value={w.period} onValueChange={(v) => onChange({ period: v as Period })}>
            <SelectTrigger className="w-auto min-w-32" aria-label={t("Periodo")}>
              <SelectValue />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="month">{t("por mes")}</SelectItem>
              <SelectItem value="day">{t("por día")}</SelectItem>
            </SelectContent>
          </Select>
        </div>

        <div className="grid grid-cols-2 gap-x-3 gap-y-2">
          <NumberField
            label={t("Tokens de salida")}
            className="row-span-3 grid-rows-subgrid"
            value={w.outputTokens}
            onChange={(outputTokens) => onChange({ outputTokens })}
            disabled={hasOutputSample}
            hint={hasOutputSample ? t("Se usa tu respuesta típica.") : undefined}
          />
          <NumberField
            label={t("Prefijo fijo")}
            className="row-span-3 grid-rows-subgrid"
            value={w.fixedInputTokens}
            onChange={(fixedInputTokens) => onChange({ fixedInputTokens })}
            hint={t("System prompt, reglas y herramientas.")}
          />
        </div>

        <NumberField
          label={t("Veces que se repite tu texto por solicitud")}
          value={w.sampleCopies}
          min={1}
          max={1000}
          onChange={(sampleCopies) => onChange({ sampleCopies })}
          hint={t("Ej. 5 fragmentos de documentos en una consulta RAG.")}
        />
      </Group>

      <Group title={t("Ahorros")}>
        <SliderField
          label={t("Aciertos de caché del prefijo")}
          value={w.cacheHitRate}
          onChange={(cacheHitRate) => onChange({ cacheHitRate })}
          hint={t("Solicitudes que encuentran el prefijo ya cacheado. Leer caché cuesta una fracción.")}
        />
        <SliderField
          label={t("Parte de tu texto que se repite")}
          value={w.sampleReusePct}
          onChange={(sampleReusePct) => onChange({ sampleReusePct })}
          hint={t("Si varias solicitudes comparten el mismo documento, también se cachea.")}
        />
        <SliderField
          label={t("Tráfico por Batch API")}
          value={w.batchShare}
          onChange={(batchShare) => onChange({ batchShare })}
          hint={t("Proceso asíncrono con descuento. Solo en modelos que lo ofrecen.")}
        />
      </Group>

      <Group title={t("Razonamiento")}>
        <NumberField
          label={t("Tokens de razonamiento extra")}
          value={w.reasoningTokens}
          onChange={(reasoningTokens) => onChange({ reasoningTokens })}
          hint={t("Los modelos que razonan cobran su «pensamiento» como salida. Lo ves en usage.reasoning_tokens.")}
        />
        <div className="flex items-center justify-between gap-4">
          <Label htmlFor="reason-optional" className="text-xs leading-snug font-medium">
            {t("Aplicar también donde el razonamiento es opcional")}
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
