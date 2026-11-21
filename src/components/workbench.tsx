"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { CalibrateDialog } from "@/components/calibrate-dialog";
import { CompareView } from "@/components/compare-view";
import { FiltersBar, type VendorOption } from "@/components/filters-bar";
import { CostChart } from "@/components/cost-chart";
import { FrontierChart } from "@/components/frontier-chart";
import { ModelTicket } from "@/components/model-ticket";
import { Picks } from "@/components/picks";
import { ResultsTable } from "@/components/results-table";
import { SamplePanel, type AppSample } from "@/components/sample-panel";
import { SiteHeader } from "@/components/site-header";
import { StickyAside } from "@/components/sticky-aside";
import { TokenRibbon, type RibbonEstimate } from "@/components/token-ribbon";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { WorkloadPanel } from "@/components/workload-panel";
import {
  DEFAULT_FILTERS,
  DEFAULT_WORKLOAD,
  requestsPerMonth,
  type FilterState,
  type SampleKind,
  type WorkloadState,
} from "@/lib/app-state";
import type { Catalog } from "@/lib/catalog/types";
import { MAX_COMPARE } from "@/lib/compare";
import { analyze, applyFilters, computeRows, type Row } from "@/lib/compute-rows";
import { makeExcerpt } from "@/lib/excerpt";
import { formatInt } from "@/lib/format";
import { DEFAULT_PRESET, PRESETS, type Preset } from "@/lib/presets";
import type { RefineApi } from "@/lib/refine";
import {
  TOKENIZER_IDS,
  TOKENIZERS,
  repoEngineId,
  type TokenizerId,
} from "@/lib/tokenizers/registry";
import { mean, resolveFamilyTokens, type Calibration } from "@/lib/tokenizers/resolve";
import { useSegments } from "@/lib/tokenizers/use-segments";
import { MAX_REPOS, useTokenCounts } from "@/lib/tokenizers/use-token-counts";
import { vendorLabel } from "@/lib/catalog/vendors";

const STORAGE_KEY = "tokenometro:v1";

/** Deterministic ids for the first render (server and client must agree). */
function presetSamples(preset: Preset, unique: boolean): AppSample[] {
  return preset.samples.map((s, i) => ({
    id: unique ? crypto.randomUUID() : `${preset.id}-${i}`,
    name: s.name,
    text: s.text,
    rev: 0,
    kind: "input" as const,
    fromFile: false,
  }));
}

interface Stored {
  workload?: Partial<WorkloadState>;
  filters?: Partial<FilterState>;
  pinned?: string[];
  calibration?: Calibration;
  /** Example loaded and not edited since. Lets a reload bring back its text. */
  presetId?: string | null;
  /** Per-model tokenizers that were loaded; restored from the browser cache, never re-downloaded. */
  refined?: string[];
}

export function Workbench({ catalog }: { catalog: Catalog }) {
  const [samples, setSamples] = useState<AppSample[]>(() => presetSamples(DEFAULT_PRESET, false));
  const [workload, setWorkload] = useState<WorkloadState>(() => ({
    ...DEFAULT_WORKLOAD,
    ...DEFAULT_PRESET.workload,
  }));
  const [filters, setFilters] = useState<FilterState>(DEFAULT_FILTERS);
  const [pinned, setPinned] = useState<Set<string>>(() => new Set());
  const [calibration, setCalibration] = useState<Calibration>({});
  const [tab, setTab] = useState("table");
  const [ticketId, setTicketId] = useState<string | null>(null);
  const [presetId, setPresetId] = useState<string | null>(DEFAULT_PRESET.id);
  // Called before the persistence effects: they restore tokenizers into this worker.
  const tk = useTokenCounts(samples);
  const { restoreRepos, readyRepos } = tk;

  // --- persistence: per-viewer convenience only. Your texts are never stored;
  // only the id of an example you loaded and did not edit.
  const restored = useRef(false);
  /* eslint-disable react-hooks/set-state-in-effect -- saved state can only be read after hydration; reading it during render would break SSR */
  useEffect(() => {
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        const s = JSON.parse(raw) as Stored;
        if (s.workload) setWorkload((w) => ({ ...w, ...s.workload }));
        if (s.filters) setFilters((f) => ({ ...f, ...s.filters, search: "" }));
        if (s.pinned) setPinned(new Set(s.pinned));
        if (s.calibration) setCalibration(s.calibration);
        const preset = PRESETS.find((p) => p.id === s.presetId);
        if (preset && preset.id !== DEFAULT_PRESET.id) {
          setSamples(presetSamples(preset, true));
          setPresetId(preset.id);
        }
        if (Array.isArray(s.refined)) restoreRepos(s.refined.filter((r) => typeof r === "string"));
      }
    } catch {
      /* storage blocked or corrupt: start fresh */
    }
    restored.current = true;
  }, [restoreRepos]);
  /* eslint-enable react-hooks/set-state-in-effect */

  useEffect(() => {
    if (!restored.current) return;
    const t = setTimeout(() => {
      try {
        localStorage.setItem(
          STORAGE_KEY,
          JSON.stringify({
            workload,
            filters: { ...filters, search: "" },
            pinned: [...pinned],
            calibration,
            presetId,
            refined: readyRepos,
          } satisfies Stored),
        );
      } catch {
        /* storage blocked: fine */
      }
    }, 400);
    return () => clearTimeout(t);
  }, [workload, filters, pinned, calibration, presetId, readyRepos]);

  // --- tokens
  // An empty sample (just added, not filled yet) must not average in as 0 tokens.
  const kinds = useMemo(() => samples.map((s) => (s.text.trim() ? s.kind : null)), [samples]);

  const meanOf = useCallback(
    (perSample: number[] | null | undefined, kind: SampleKind) => {
      if (!perSample) return undefined;
      const picked = perSample.filter((_, i) => kinds[i] === kind);
      return picked.length > 0 ? mean(picked) : undefined;
    },
    [kinds],
  );

  // --- cost
  const tokenInputs = useMemo(
    () => ({ kinds, engines: tk.engineCounts, calibration }),
    [kinds, tk.engineCounts, calibration],
  );
  const allRows = useMemo(
    () => computeRows(catalog.models, tokenInputs, workload),
    [catalog.models, tokenInputs, workload],
  );
  const filtered = useMemo(() => applyFilters(allRows, filters, pinned), [allRows, filters, pinned]);
  const analysis = useMemo(() => analyze(filtered), [filtered]);
  const perMonth = requestsPerMonth(workload);

  // --- ribbon
  const firstText = samples.find((s) => s.kind === "input" && s.text.trim())?.text ?? "";
  const excerpt = useMemo(() => makeExcerpt(firstText), [firstText]);
  const pieces = useSegments(tk.segment, excerpt, tk.readyIds);

  const totals = useMemo(() => {
    const out: Partial<Record<TokenizerId, number>> = {};
    for (const id of tk.readyIds) {
      const m = meanOf(tk.engineCounts[id], "input");
      if (m !== undefined) out[id] = m;
    }
    return out;
  }, [tk.readyIds, tk.engineCounts, meanOf]);

  const modelsPerFamily = useMemo(() => {
    const out: Partial<Record<TokenizerId, number>> = {};
    for (const m of catalog.models) out[m.tokenizer] = (out[m.tokenizer] ?? 0) + 1;
    return out;
  }, [catalog.models]);

  const estimates = useMemo<RibbonEstimate[]>(() => {
    const out: RibbonEstimate[] = [];
    for (const id of TOKENIZER_IDS) {
      const engine = TOKENIZERS[id].engine;
      if (engine === "tiktoken" || engine === "hf") continue;
      const models = modelsPerFamily[id] ?? 0;
      if (models === 0) continue;
      const r = resolveFamilyTokens(id, tk.engineCounts, calibration);
      const tokens = meanOf(r.perSample, "input");
      if (tokens === undefined || r.accuracy === "exact") continue;
      out.push({ id, tokens, accuracy: r.accuracy, models });
    }
    return out.sort((a, b) => b.models - a.models);
  }, [modelsPerFamily, tk.engineCounts, calibration, meanOf]);

  const exactModels = allRows.filter((r) => r.accuracy === "exact" || r.accuracy === "calibrated").length;

  // --- filters data
  const vendors = useMemo<VendorOption[]>(() => {
    const counts = new Map<string, number>();
    for (const m of catalog.models) counts.set(m.vendorSlug, (counts.get(m.vendorSlug) ?? 0) + 1);
    return [...counts.entries()]
      .map(([slug, count]) => ({ slug, label: vendorLabel(slug), count }))
      .sort((a, b) => b.count - a.count || a.label.localeCompare(b.label));
  }, [catalog.models]);
  const maxIntelligence = useMemo(
    () => Math.ceil(Math.max(0, ...catalog.models.map((m) => m.intelligence ?? 0))),
    [catalog.models],
  );

  // --- handlers
  const patchWorkload = useCallback((patch: Partial<WorkloadState>) => setWorkload((w) => ({ ...w, ...patch })), []);
  const patchFilters = useCallback((patch: Partial<FilterState>) => setFilters((f) => ({ ...f, ...patch })), []);

  const addSample = useCallback((kind: SampleKind, name: string, text: string, fromFile: boolean) => {
    setPresetId(null);
    setSamples((prev) => {
      const taken = new Set(prev.map((s) => s.name));
      let unique = name;
      for (let n = 2; taken.has(unique); n++) unique = `${name} ${n}`;
      return [...prev, { id: crypto.randomUUID(), name: unique, text, rev: 0, kind, fromFile }];
    });
  }, []);
  const editSample = useCallback((id: string, text: string) => {
    setPresetId(null);
    setSamples((prev) => prev.map((s) => (s.id === id ? { ...s, text, rev: s.rev + 1 } : s)));
  }, []);
  const removeSample = useCallback((id: string) => {
    setPresetId(null);
    setSamples((prev) => prev.filter((s) => s.id !== id));
  }, []);
  const loadPreset = useCallback((id: string) => {
    const preset = PRESETS.find((p) => p.id === id);
    if (!preset) return;
    setPresetId(preset.id);
    setSamples(presetSamples(preset, true));
    setWorkload({ ...DEFAULT_WORKLOAD, ...preset.workload });
  }, []);
  const togglePin = useCallback(
    (id: string) =>
      setPinned((prev) => {
        const next = new Set(prev);
        if (!next.delete(id)) next.add(id);
        return next;
      }),
    [],
  );

  const { countText } = tk;
  const countO200k = useCallback((text: string) => countText("o200k", text), [countText]);

  // --- per-model tokenizers
  const { refinedRepos, refine: refineRepo, unrefine, status: engineStatus } = tk;
  const refinedSet = useMemo(() => new Set(refinedRepos), [refinedRepos]);
  const refineApi: RefineApi = {
    refined: refinedSet,
    status: (repo) => engineStatus(repoEngineId(repo)),
    refine: (repos) => repos.filter((repo) => refineRepo(repo)).length,
    remove: unrefine,
    room: MAX_REPOS - refinedRepos.length,
  };

  // --- compare: the pinned models are the comparison set
  const compareRows = useMemo<Row[]>(
    () =>
      allRows
        .filter((r) => pinned.has(r.model.id))
        .sort((a, b) => a.monthly - b.monthly)
        .slice(0, MAX_COMPARE),
    [allRows, pinned],
  );
  const pickRows = useMemo<Row[]>(() => {
    const seen = new Set<string>();
    return [analysis.cheapest, analysis.balanced, analysis.bestQuality].filter((r): r is Row => {
      if (!r || seen.has(r.model.id)) return false;
      seen.add(r.model.id);
      return true;
    });
  }, [analysis.cheapest, analysis.balanced, analysis.bestQuality]);
  const usePicks = useCallback(
    () => setPinned((prev) => new Set([...prev, ...pickRows.map((r) => r.model.id)])),
    [pickRows],
  );
  const pinModel = useCallback((id: string) => setPinned((prev) => new Set(prev).add(id)), []);
  const unpinModel = useCallback(
    (id: string) =>
      setPinned((prev) => {
        const next = new Set(prev);
        next.delete(id);
        return next;
      }),
    [],
  );
  const clearPins = useCallback(() => setPinned(new Set()), []);

  const inputCounts = samples.map((_, i) => tk.engineCounts.o200k?.[i]);
  const hasText = samples.some((s) => s.kind === "input" && s.text.trim().length > 0);
  const waiting = hasText && allRows.length === 0;
  const ticketRow = ticketId ? (allRows.find((r) => r.model.id === ticketId) ?? null) : null;
  const open = useCallback((row: { model: { id: string } }) => setTicketId(row.model.id), []);

  return (
    <div className="mx-auto w-full max-w-[1440px] px-5 pb-24 sm:px-8">
      <SiteHeader source={catalog.source} fetchedAt={catalog.fetchedAt} modelCount={catalog.models.length} />

      {/* The headline plays Allo's axes against each other: thin and sharp, black and round. */}
      <div className="pt-10 pb-14 sm:pt-16 sm:pb-20">
        <h1 className="max-w-4xl text-[44px] leading-[0.98] sm:text-[72px]">
          <span className="role-thin">¿Cuánto cuesta</span>{" "}
          <span className="role-display text-blue">tu texto</span>{" "}
          <span className="role-thin">en cada</span>{" "}
          <span className="role-display text-pink">modelo</span>
          <span className="role-display">?</span>
        </h1>
        <p className="mt-6 max-w-2xl text-base leading-relaxed text-muted-foreground sm:text-lg">
          Cuenta tokens con el tokenizador real de cada modelo y proyecta el gasto mensual de tu API con tu propia
          carga. Todo se calcula en este navegador.
        </p>
      </div>

      <div className="grid items-start gap-5 lg:grid-cols-[384px_minmax(0,1fr)] lg:gap-8">
        <StickyAside className="grid grid-cols-[minmax(0,1fr)] gap-5">
          <SamplePanel
            samples={samples}
            counts={inputCounts}
            onAdd={addSample}
            onEdit={editSample}
            onRemove={removeSample}
            onPreset={loadPreset}
          />
          <WorkloadPanel
            workload={workload}
            onChange={patchWorkload}
            hasOutputSample={samples.some((s) => s.kind === "output" && s.text.trim().length > 0)}
          />
        </StickyAside>

        <main className="grid min-w-0 grid-cols-[minmax(0,1fr)] gap-5">
          <TokenRibbon
            excerpt={excerpt}
            pieces={pieces}
            engineIds={tk.readyIds}
            totals={totals}
            estimates={estimates}
            status={tk.status}
            onLoadAll={tk.loadAllHf}
            onRetry={tk.loadEngine}
            exactModels={exactModels}
            totalModels={allRows.length}
            hasSamples={hasText}
            calibrate={
              <CalibrateDialog
                models={catalog.models}
                texts={samples.filter((s) => s.kind === "input").map((s) => s.text)}
                countLocal={countO200k}
                calibration={calibration}
                onChange={setCalibration}
              />
            }
          />

          {waiting ? (
            <div className="grid gap-3" aria-busy="true" aria-label="Calculando costos">
              <div className="grid gap-3 sm:grid-cols-3">
                {[0, 1, 2].map((i) => (
                  <div key={i} className="h-40 animate-pulse rounded-[28px] bg-card" />
                ))}
              </div>
              <div className="h-72 animate-pulse rounded-[28px] bg-card" />
            </div>
          ) : (
            <>
              <Picks analysis={analysis} onOpen={open} />
              <FiltersBar
                filters={filters}
                onChange={patchFilters}
                vendors={vendors}
                maxIntelligence={maxIntelligence}
                shown={filtered.length}
                total={allRows.length}
                compareCount={tab === "compare" ? 0 : pinned.size}
                onCompare={() => setTab("compare")}
              />
              <Tabs value={tab} onValueChange={setTab} className="gap-4">
                <TabsList className="w-full sm:w-fit">
                  <TabsTrigger value="table">Tabla</TabsTrigger>
                  <TabsTrigger value="cost">Costos</TabsTrigger>
                  <TabsTrigger value="frontier">Calidad × costo</TabsTrigger>
                  <TabsTrigger value="compare">
                    Comparar{pinned.size > 0 && <span className="num text-muted-foreground">{pinned.size}</span>}
                  </TabsTrigger>
                </TabsList>
                <TabsContent value="table">
                  <ResultsTable
                    rows={filtered}
                    analysis={analysis}
                    pinned={pinned}
                    onTogglePin={togglePin}
                    onOpen={open}
                    refine={refineApi}
                  />
                </TabsContent>
                <TabsContent value="cost">
                  <CostChart rows={filtered} pinned={pinned} requestsPerMonth={perMonth} onOpen={open} />
                </TabsContent>
                <TabsContent value="frontier">
                  <FrontierChart rows={filtered} analysis={analysis} pinned={pinned} onOpen={open} />
                </TabsContent>
                <TabsContent value="compare">
                  <CompareView
                    rows={compareRows}
                    pinnedTotal={pinned.size}
                    candidates={allRows}
                    picks={pickRows}
                    heading={`${formatInt(perMonth)} solicitudes al mes`}
                    refine={refineApi}
                    onAdd={pinModel}
                    onRemove={unpinModel}
                    onClear={clearPins}
                    onUsePicks={usePicks}
                    onOpen={open}
                  />
                </TabsContent>
              </Tabs>
            </>
          )}
        </main>
      </div>

      <ModelTicket
        row={ticketRow}
        requestsPerMonth={perMonth}
        batchShare={workload.batchShare}
        isPinned={ticketId ? pinned.has(ticketId) : false}
        onTogglePin={togglePin}
        onClose={() => setTicketId(null)}
        refine={refineApi}
      />
    </div>
  );
}
