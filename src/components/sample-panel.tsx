"use client";

import { useEffect, useRef, useState } from "react";
import { cn } from "cn";
import { Sym } from "@/components/sym";
import { Button } from "@/components/ui/button";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Textarea } from "@/components/ui/textarea";
import { Step } from "@/components/field";
import type { SampleKind } from "@/lib/app-state";
import { formatInt } from "@/lib/format";
import { PRESETS } from "@/lib/presets";
import type { Sample } from "@/lib/tokenizers/use-token-counts";

export interface AppSample extends Sample {
  kind: SampleKind;
  /** Came from a file: shown as a preview, not editable inline. */
  fromFile: boolean;
}

const MAX_FILE_BYTES = 20 * 1024 * 1024;

interface Props {
  samples: AppSample[];
  /** o200k token count per sample, aligned with `samples`; undefined while counting. */
  counts: (number | undefined)[];
  onAdd: (kind: SampleKind, name: string, text: string, fromFile: boolean) => void;
  onEdit: (id: string, text: string) => void;
  onRemove: (id: string) => void;
  onPreset: (presetId: string) => void;
}

/** Text that is binary (has NUL bytes) cannot be tokenized meaningfully. */
const looksBinary = (text: string) => text.slice(0, 8192).includes("\u0000");

export function SamplePanel({ samples, counts, onAdd, onEdit, onRemove, onPreset }: Props) {
  const [kind, setKind] = useState<SampleKind>("input");
  const [dragging, setDragging] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const [presetsOpen, setPresetsOpen] = useState(false);
  const fileInput = useRef<HTMLInputElement>(null);

  const visible = samples
    .map((sample, index) => ({ sample, index }))
    .filter(({ sample }) => sample.kind === kind);
  const countOf = (k: SampleKind) => samples.filter((s) => s.kind === k).length;

  async function readFiles(files: FileList | File[]) {
    setProblem(null);
    const rejected: string[] = [];
    for (const file of Array.from(files)) {
      if (file.size > MAX_FILE_BYTES) {
        rejected.push(`${file.name}: pesa más de 20 MB`);
        continue;
      }
      const text = await file.text();
      if (looksBinary(text)) {
        rejected.push(`${file.name}: no es texto (PDF, Word o imagen). Copia su texto y pégalo.`);
        continue;
      }
      onAdd(kind, file.name, text, true);
    }
    if (rejected.length > 0) setProblem(rejected.join(" · "));
  }

  return (
    <Step
      n={1}
      title="Tu texto"
      action={
        <Popover open={presetsOpen} onOpenChange={setPresetsOpen}>
          <PopoverTrigger asChild>
            <Button variant="outline" size="sm">
              <Sym>★</Sym> Ejemplos
            </Button>
          </PopoverTrigger>
          <PopoverContent align="end" className="w-80 p-2">
            <p className="px-3 pt-2 pb-2 text-xs leading-snug text-muted-foreground">
              Cargan un texto y una carga de trabajo típica. Reemplazan lo que tengas.
            </p>
            {PRESETS.map((p) => (
              <button
                key={p.id}
                type="button"
                onClick={() => {
                  onPreset(p.id);
                  setPresetsOpen(false);
                  setKind("input");
                }}
                className="flex w-full flex-col items-start gap-0.5 rounded-2xl px-3 py-2.5 text-left outline-none hover:bg-secondary focus-visible:bg-secondary"
              >
                <span className="text-sm font-semibold">{p.label}</span>
                <span className="text-xs text-muted-foreground">{p.blurb}</span>
              </button>
            ))}
          </PopoverContent>
        </Popover>
      }
    >
      <div className="grid gap-3">
        <Tabs value={kind} onValueChange={(v) => setKind(v as SampleKind)}>
          <TabsList className="w-full">
            <TabsTrigger value="input">
              Entrada <span className="num text-muted-foreground">{countOf("input")}</span>
            </TabsTrigger>
            <TabsTrigger value="output">
              Respuesta típica <span className="num text-muted-foreground">{countOf("output")}</span>
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <p className="text-xs leading-relaxed text-muted-foreground">
          {kind === "input"
            ? "Lo que enviarías al modelo en una solicitud típica: un documento, un correo, un fragmento de código. Con varias muestras se promedia."
            : "Opcional. Pega una respuesta típica para contar la salida con cada tokenizador. Sin ella se usan los tokens de salida de abajo."}
        </p>
      </div>

      <div
        onDragOver={(e) => {
          e.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          void readFiles(e.dataTransfer.files);
        }}
        className={cn(
          "grid gap-4 rounded-3xl transition-[background-color,box-shadow]",
          dragging && "bg-blue/10 ring-4 ring-blue/30",
        )}
      >
        {visible.length === 0 && (
          <div className="grid place-items-center gap-1.5 rounded-3xl bg-raise px-5 py-8 text-center shadow-raise">
            <Sym className="text-2xl text-faint">↑</Sym>
            <p className="text-sm font-semibold">
              {kind === "input" ? "Aún no hay texto" : "Sin respuesta de ejemplo"}
            </p>
            <p className="text-xs leading-snug text-muted-foreground">
              Pega un texto, suelta archivos aquí o carga un ejemplo.
            </p>
          </div>
        )}

        {visible.map(({ sample, index }) => (
          <SampleCard
            key={sample.id}
            sample={sample}
            tokens={counts[index]}
            onEdit={(text) => onEdit(sample.id, text)}
            onRemove={() => onRemove(sample.id)}
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-2">
        <Button
          variant="outline"
          size="sm"
          onClick={() => onAdd(kind, kind === "input" ? "Texto pegado" : "Respuesta pegada", "", false)}
        >
          <Sym>+</Sym> Pegar texto
        </Button>
        <Button variant="outline" size="sm" onClick={() => fileInput.current?.click()}>
          <Sym>↑</Sym> Subir archivos
        </Button>
        <input
          ref={fileInput}
          type="file"
          multiple
          hidden
          accept=".txt,.md,.markdown,.csv,.tsv,.json,.jsonl,.xml,.html,.htm,.log,.yml,.yaml,.toml,.ini,.sql,.js,.jsx,.ts,.tsx,.py,.go,.rs,.java,.rb,.php,.c,.cpp,.h,.cs,.swift,.kt,.sh,text/*"
          onChange={(e) => {
            if (e.target.files) void readFiles(e.target.files);
            e.target.value = "";
          }}
        />
      </div>

      {problem && (
        <p role="alert" className="text-xs leading-snug text-destructive">
          <Sym>⚠</Sym> {problem}
        </p>
      )}

      <p className="flex items-start gap-2 text-xs leading-snug text-muted-foreground">
        <Sym className="mt-px text-signal-ink">✓</Sym>
        Tu texto se cuenta en este navegador. No se envía a ningún servidor.
      </p>
    </Step>
  );
}

function SampleCard({
  sample,
  tokens,
  onEdit,
  onRemove,
}: {
  sample: AppSample;
  tokens: number | undefined;
  onEdit: (text: string) => void;
  onRemove: () => void;
}) {
  // Edit locally and commit when typing pauses: a 1 MB paste must not re-count per keystroke.
  const [draft, setDraft] = useState(sample.text);
  const lastCommitted = useRef(sample.text);

  useEffect(() => {
    if (draft === lastCommitted.current) return;
    const t = setTimeout(() => {
      lastCommitted.current = draft;
      onEdit(draft);
    }, 280);
    return () => clearTimeout(t);
  }, [draft, onEdit]);

  const chars = draft.length;
  return (
    <div className="grid gap-2">
      <div className="flex items-center justify-between gap-2 pl-1">
        <span className="truncate text-xs font-semibold">{sample.name}</span>
        <Button variant="ghost" size="icon-xs" onClick={onRemove} aria-label={`Quitar ${sample.name}`}>
          <Sym>⌫</Sym>
        </Button>
      </div>
      {sample.fromFile ? (
        <pre className="raw line-clamp-3 max-h-20 overflow-hidden rounded-2xl bg-raise px-4 py-3 text-xs leading-snug whitespace-pre-wrap text-muted-foreground shadow-raise">
          {sample.text.slice(0, 400)}
        </pre>
      ) : (
        <Textarea
          value={draft}
          onChange={(e) => setDraft(e.target.value)}
          placeholder="Pega aquí un texto típico…"
          spellCheck={false}
          className="raw field-sizing-fixed h-32 max-h-80 min-h-20 resize-y text-[13px] leading-relaxed"
          aria-label={`Texto de ${sample.name}`}
        />
      )}
      <p className="num pl-1 text-xs text-muted-foreground">
        {formatInt(chars)} caracteres ·{" "}
        {tokens === undefined ? "contando…" : `${formatInt(tokens)} tokens (o200k)`}
      </p>
    </div>
  );
}
