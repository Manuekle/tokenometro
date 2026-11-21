"use client";

import { usePreferences } from "@/components/preferences-provider";
import { Sym } from "@/components/sym";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Popover, PopoverContent, PopoverTrigger } from "@/components/ui/popover";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Switch } from "@/components/ui/switch";
import { NumberField, SliderField } from "@/components/field";
import { DEFAULT_FILTERS, type FilterState } from "@/lib/app-state";

export interface VendorOption {
  slug: string;
  label: string;
  count: number;
}

interface Props {
  filters: FilterState;
  onChange: (patch: Partial<FilterState>) => void;
  vendors: VendorOption[];
  maxIntelligence: number;
  shown: number;
  total: number;
  /** Pinned models ready to compare; the button appears from two. */
  compareCount: number;
  onCompare: () => void;
}

const CONTEXTS = [
  { value: 0, label: "Cualquiera" },
  { value: 32_000, label: "32K o más" },
  { value: 128_000, label: "128K o más" },
  { value: 200_000, label: "200K o más" },
  { value: 1_000_000, label: "1M o más" },
];

function activeCount(f: FilterState): number {
  return [
    f.vendors.length > 0,
    f.minIntelligence > 0,
    f.maxMonthly !== null,
    f.minContext > 0,
    f.vision,
    f.tools,
    f.openWeightsOnly,
    f.includeFree,
    !f.hideNoFit,
    f.pinnedOnly,
  ].filter(Boolean).length;
}

export function FiltersBar({
  filters: f,
  onChange,
  vendors,
  maxIntelligence,
  shown,
  total,
  compareCount,
  onCompare,
}: Props) {
  const { t } = usePreferences();
  const active = activeCount(f) + (f.search ? 1 : 0);

  return (
    <div className="flex flex-wrap items-center gap-2">
      <div className="relative min-w-0 basis-full flex-1 sm:min-w-52 sm:basis-60">
        <Sym className="pointer-events-none absolute top-1/2 left-4 -translate-y-1/2 text-base text-muted-foreground">
          ⌕
        </Sym>
        <Input
          value={f.search}
          onChange={(e) => onChange({ search: e.target.value })}
          placeholder={t("Buscar modelo o proveedor")}
          aria-label={t("Buscar modelo o proveedor")}
          className="pl-10"
        />
      </div>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline">
            {t("Proveedores")}
            {f.vendors.length > 0 && <Badge className="num">{f.vendors.length}</Badge>}
            <Sym className="text-muted-foreground">⌄</Sym>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="w-72 p-2">
          <div className="flex items-center justify-between px-3 py-2">
            <p className="role-label text-muted-foreground">{t("Proveedores")}</p>
            <Button
              variant="ghost"
              size="xs"
              disabled={f.vendors.length === 0}
              onClick={() => onChange({ vendors: [] })}
            >
              {t("Todos")}
            </Button>
          </div>
          <ul className="max-h-72 overflow-y-auto">
            {vendors.map((v) => {
              const checked = f.vendors.includes(v.slug);
              return (
                <li key={v.slug}>
                  <label className="flex cursor-pointer items-center gap-3 rounded-2xl px-3 py-2 text-sm hover:bg-secondary">
                    <Checkbox
                      checked={checked}
                      onCheckedChange={(on) =>
                        onChange({
                          vendors: on ? [...f.vendors, v.slug] : f.vendors.filter((s) => s !== v.slug),
                        })
                      }
                    />
                    <span className="flex-1 truncate font-medium">{v.label}</span>
                    <span className="num text-xs text-muted-foreground">{v.count}</span>
                  </label>
                </li>
              );
            })}
          </ul>
        </PopoverContent>
      </Popover>

      <Popover>
        <PopoverTrigger asChild>
          <Button variant="outline">
            {t("Filtros")}
            {activeCount(f) > 0 && <Badge className="num">{activeCount(f)}</Badge>}
            <Sym className="text-muted-foreground">⌄</Sym>
          </Button>
        </PopoverTrigger>
        <PopoverContent align="start" className="grid w-[22rem] gap-5 p-5">
          <SliderField
            label={t("Calidad mínima")}
            value={f.minIntelligence}
            min={0}
            max={maxIntelligence}
            step={1}
            format={(v) => (v === 0 ? t("sin mínimo") : t("índice ≥ {0}", [v]))}
            onChange={(minIntelligence) => onChange({ minIntelligence })}
            hint={t("Índice de inteligencia de Artificial Analysis. Los modelos sin índice quedan fuera si lo exiges.")}
          />
          <NumberField
            label={t("Presupuesto máximo al mes")}
            value={f.maxMonthly ?? 0}
            suffix="USD"
            onChange={(v) => onChange({ maxMonthly: v > 0 ? v : null })}
            hint={t("0 significa sin límite.")}
          />
          <div className="grid gap-2">
            <Label>{t("Contexto mínimo")}</Label>
            <Select value={String(f.minContext)} onValueChange={(v) => onChange({ minContext: Number(v) })}>
              <SelectTrigger className="w-full" aria-label={t("Contexto mínimo")}>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {CONTEXTS.map((c) => (
                  <SelectItem key={c.value} value={String(c.value)}>
                    {t(c.label)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div className="grid gap-3.5">
            <Toggle
              id="f-vision"
              label={t("Acepta imágenes")}
              checked={f.vision}
              onChange={(vision) => onChange({ vision })}
            />
            <Toggle
              id="f-tools"
              label={t("Usa herramientas (function calling)")}
              checked={f.tools}
              onChange={(tools) => onChange({ tools })}
            />
            <Toggle
              id="f-open"
              label={t("Solo pesos abiertos")}
              checked={f.openWeightsOnly}
              onChange={(openWeightsOnly) => onChange({ openWeightsOnly })}
            />
            <Toggle
              id="f-free"
              label={t("Incluir modelos gratuitos")}
              checked={f.includeFree}
              onChange={(includeFree) => onChange({ includeFree })}
            />
            <Toggle
              id="f-fit"
              label={t("Ocultar si tu solicitud no cabe")}
              checked={f.hideNoFit}
              onChange={(hideNoFit) => onChange({ hideNoFit })}
            />
            <Toggle
              id="f-pin"
              label={t("Solo mis fijados")}
              checked={f.pinnedOnly}
              onChange={(pinnedOnly) => onChange({ pinnedOnly })}
            />
          </div>
        </PopoverContent>
      </Popover>

      {active > 0 && (
        <Button variant="ghost" onClick={() => onChange({ ...DEFAULT_FILTERS })}>
          <Sym>✕</Sym> {t(" Limpiar")}
        </Button>
      )}

      {compareCount >= 2 && (
        <Button onClick={onCompare}>
          <Sym className="text-orange">★</Sym> {t(" Comparar ")}
          {compareCount} <Sym>→</Sym>
        </Button>
      )}

      <p className="num ml-auto text-xs text-muted-foreground" role="status">
        {t("{0} de {1} modelos", [shown, total])}
      </p>
    </div>
  );
}

function Toggle({
  id,
  label,
  checked,
  onChange,
}: {
  id: string;
  label: string;
  checked: boolean;
  onChange: (value: boolean) => void;
}) {
  return (
    <div className="flex items-center justify-between gap-4">
      <Label htmlFor={id} className="text-[13px] font-medium">
        {label}
      </Label>
      <Switch id={id} checked={checked} onCheckedChange={onChange} />
    </div>
  );
}
