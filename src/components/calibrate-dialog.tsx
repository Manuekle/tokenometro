"use client";

import { useMemo, useState } from "react";
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
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Field } from "@/components/field";
import type { ModelInfo } from "@/lib/catalog/types";
import {
  ProviderError,
  anthropicModelId,
  countAnthropic,
  countGemini,
  geminiModelId,
  measureRatio,
} from "@/lib/provider-count";
import type { Calibration } from "@/lib/tokenizers/resolve";

type Provider = "claude" | "gemini";

const PROVIDERS: Record<Provider, { label: string; vendor: string; keyHint: string }> = {
  claude: { label: "Claude", vendor: "Anthropic", keyHint: "sk-ant-…" },
  gemini: { label: "Gemini", vendor: "Google", keyHint: "AIza…" },
};

/** Most characters per sample sent to the vendor, and how many samples. */
const MAX_CHARS = 20_000;
const MAX_SAMPLES = 3;

interface Props {
  models: ModelInfo[];
  /** Current input samples. */
  texts: string[];
  /** o200k count of a text, computed locally. */
  countLocal: (text: string) => Promise<number>;
  calibration: Calibration;
  onChange: (next: Calibration) => void;
}

export function CalibrateDialog({ models, texts, countLocal, calibration, onChange }: Props) {
  const [provider, setProvider] = useState<Provider>("claude");
  const [apiKey, setApiKey] = useState("");
  const [modelId, setModelId] = useState<Record<Provider, string>>({ claude: "", gemini: "" });
  const [phase, setPhase] = useState<"idle" | "running">("idle");
  const [message, setMessage] = useState<{ kind: "ok" | "error"; text: string } | null>(null);

  const options = useMemo(
    () => ({
      claude: models.filter((m) => m.tokenizer === "claude").slice(0, 12),
      gemini: models.filter((m) => m.tokenizer === "gemini").slice(0, 12),
    }),
    [models],
  );
  const selected = modelId[provider] || options[provider][0]?.id || "";
  const affected = models.filter((m) => m.tokenizer === provider).length;
  const usable = texts.filter((t) => t.trim().length > 0);

  async function run() {
    setPhase("running");
    setMessage(null);
    try {
      const sample = usable.slice(0, MAX_SAMPLES).map((t) => t.slice(0, MAX_CHARS));
      const model = provider === "claude" ? anthropicModelId(selected) : geminiModelId(selected);
      const vendorCount = (text: string) =>
        provider === "claude"
          ? countAnthropic({ apiKey: apiKey.trim(), model, text })
          : countGemini({ apiKey: apiKey.trim(), model, text });
      const ratio = await measureRatio({ texts: sample, vendorCount, localCount: countLocal });
      onChange({ ...calibration, [provider]: ratio });
      setMessage({
        kind: "ok",
        text: `${PROVIDERS[provider].label} cuenta ${ratio.toFixed(2)}× los tokens de OpenAI en tu texto. Se aplicó a ${affected} modelos.`,
      });
    } catch (error) {
      setMessage({
        kind: "error",
        text:
          error instanceof ProviderError
            ? error.message
            : "No se pudo conectar con el proveedor. Revisa tu conexión e intenta de nuevo.",
      });
    } finally {
      setPhase("idle");
    }
  }

  const calibrated = (Object.keys(calibration) as Provider[]).filter(
    (k) => k in PROVIDERS && calibration[k] !== undefined,
  );

  return (
    <Dialog
      onOpenChange={(open) => {
        if (!open) {
          setApiKey(""); // the key lives only while the dialog is open
          setMessage(null);
        }
      }}
    >
      <DialogTrigger asChild>
        <Button variant="outline" size="sm">
          <Sym>↻</Sym> Calibrar con la API
        </Button>
      </DialogTrigger>
      <DialogContent className="gap-6 sm:max-w-lg">
        <DialogHeader>
          <DialogTitle className="text-2xl [font-variation-settings:'ROND'_100]">Calibrar con la API</DialogTitle>
          <DialogDescription>
            Anthropic y Google no publican su tokenizador, pero ofrecen un conteo gratuito. Mide tu texto con el real y
            ajusta todos los modelos de esa familia.
          </DialogDescription>
        </DialogHeader>

        <div className="flex gap-2" role="group" aria-label="Proveedor">
          {(Object.keys(PROVIDERS) as Provider[]).map((p) => (
            <Button
              key={p}
              variant={provider === p ? "default" : "outline"}
              size="sm"
              aria-pressed={provider === p}
              onClick={() => {
                setProvider(p);
                setMessage(null);
              }}
            >
              {PROVIDERS[p].label}
              {calibration[p] !== undefined && <Sym className="text-[11px]">✓</Sym>}
            </Button>
          ))}
        </div>

        <div className="grid gap-4">
          <Field label={`Clave de la API de ${PROVIDERS[provider].vendor}`} htmlFor="calibrate-key">
            <Input
              id="calibrate-key"
              type="password"
              autoComplete="off"
              spellCheck={false}
              placeholder={PROVIDERS[provider].keyHint}
              value={apiKey}
              onChange={(e) => setApiKey(e.target.value)}
              className="num"
            />
          </Field>
          <div className="grid gap-2">
            <Label>Modelo con el que contar</Label>
            <Select value={selected} onValueChange={(v) => setModelId((s) => ({ ...s, [provider]: v }))}>
              <SelectTrigger className="w-full" aria-label="Modelo con el que contar">
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {options[provider].map((m) => (
                  <SelectItem key={m.id} value={m.id}>
                    {m.name}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <p className="text-xs leading-snug text-muted-foreground">
              Las generaciones de un mismo proveedor pueden tokenizar distinto. Elige una cercana a la que usarás.
            </p>
          </div>
        </div>

        <p className="flex items-start gap-3 rounded-2xl bg-card p-4 text-xs leading-relaxed text-muted-foreground">
          <Sym className="mt-px text-base text-signal-ink">✓</Sym>
          <span>
            La clave va directo de tu navegador a {PROVIDERS[provider].vendor}: no pasa por ningún servidor nuestro y se
            borra al cerrar esta ventana. Se envían a {PROVIDERS[provider].vendor} hasta {MAX_SAMPLES} muestras de{" "}
            {MAX_CHARS.toLocaleString("en-US")} caracteres para contarlas.
          </span>
        </p>

        {message && (
          <p
            role={message.kind === "error" ? "alert" : "status"}
            className={message.kind === "error" ? "text-sm text-destructive" : "text-sm font-semibold text-signal-ink"}
          >
            {message.text}
          </p>
        )}

        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="flex flex-wrap gap-2">
            {calibrated.map((k) => (
              <Button
                key={k}
                variant="ghost"
                size="sm"
                onClick={() => {
                  const next = { ...calibration };
                  delete next[k];
                  onChange(next);
                  setMessage(null);
                }}
              >
                Quitar calibración de {PROVIDERS[k].label}
              </Button>
            ))}
          </div>
          <Button onClick={run} disabled={phase === "running" || apiKey.trim().length < 8 || usable.length === 0 || !selected}>
            {phase === "running" ? <Sym className="animate-pulse">●</Sym> : <Sym>↻</Sym>}
            {phase === "running" ? "Contando…" : "Contar con la API"}
          </Button>
        </div>
        {usable.length === 0 && (
          <p className="-mt-3 text-xs text-muted-foreground">Agrega un texto de entrada para poder calibrar.</p>
        )}
      </DialogContent>
    </Dialog>
  );
}
