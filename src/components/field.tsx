"use client";

import { useId, useState, type ReactNode } from "react";
import { cn } from "cn";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Slider } from "@/components/ui/slider";

interface FieldProps {
  label: string;
  hint?: string;
  htmlFor?: string;
  right?: ReactNode;
  className?: string;
  children: ReactNode;
}

export function Field({ label, hint, htmlFor, right, className, children }: FieldProps) {
  return (
    <div className={cn("grid min-w-0 content-start gap-2", className)}>
      <div className="flex items-baseline justify-between gap-2">
        <Label htmlFor={htmlFor}>{label}</Label>
        {right}
      </div>
      {children}
      {hint && <p className="text-xs leading-snug text-muted-foreground">{hint}</p>}
    </div>
  );
}

interface NumberFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  suffix?: string;
  hint?: string;
  disabled?: boolean;
  className?: string;
}

/** Numeric input that lets you clear the box while typing and accepts "40,000". */
export function NumberField({
  label,
  value,
  onChange,
  min = 0,
  max = Number.MAX_SAFE_INTEGER,
  suffix,
  hint,
  disabled,
  className,
}: NumberFieldProps) {
  const id = useId();
  const [draft, setDraft] = useState<string | null>(null);
  const shown = draft ?? value.toLocaleString("en-US", { maximumFractionDigits: 4 });

  return (
    <Field label={label} hint={hint} htmlFor={id} className={className}>
      <div className="relative">
        <Input
          id={id}
          type="text"
          inputMode="decimal"
          autoComplete="off"
          disabled={disabled}
          value={shown}
          className={cn("num text-right text-[15px]", suffix && "pr-14")}
          onFocus={(e) => {
            setDraft(String(value));
            e.currentTarget.select();
          }}
          onChange={(e) => {
            const raw = e.target.value;
            setDraft(raw);
            const n = Number(raw.replace(/[,\s_]/g, ""));
            if (raw.trim() !== "" && Number.isFinite(n)) {
              onChange(Math.min(max, Math.max(min, n)));
            }
          }}
          onBlur={() => setDraft(null)}
        />
        {suffix && (
          <span className="pointer-events-none absolute inset-y-0 right-4 grid place-items-center text-xs text-muted-foreground">
            {suffix}
          </span>
        )}
      </div>
    </Field>
  );
}

interface SliderFieldProps {
  label: string;
  value: number;
  onChange: (value: number) => void;
  min?: number;
  max?: number;
  step?: number;
  format?: (value: number) => string;
  hint?: string;
  disabled?: boolean;
}

export function SliderField({
  label,
  value,
  onChange,
  min = 0,
  max = 100,
  step = 1,
  format = (v) => `${v}%`,
  hint,
  disabled,
}: SliderFieldProps) {
  const id = useId();
  return (
    <Field
      label={label}
      hint={hint}
      htmlFor={id}
      right={<span className="num text-[13px] font-bold">{format(value)}</span>}
    >
      <Slider
        id={id}
        aria-label={label}
        value={[value]}
        min={min}
        max={max}
        step={step}
        disabled={disabled}
        onValueChange={([v]) => onChange(v)}
        className="py-2"
      />
    </Field>
  );
}

/** A quiet group heading inside a panel. */
export function Group({ title, children }: { title: string; children: ReactNode }) {
  return (
    <div className="grid gap-4">
      <p className="role-label text-muted-foreground">{title}</p>
      {children}
    </div>
  );
}

/** Titled panel of the left rail. The step number is real: each step feeds the next. */
export function Step({
  n,
  title,
  action,
  children,
}: {
  n: number;
  title: string;
  action?: ReactNode;
  children: ReactNode;
}) {
  return (
    <section className="rounded-[28px] bg-card p-5 sm:p-6">
      <header className="flex items-center justify-between gap-3">
        <h2 className="flex items-center gap-3">
          <span className="num grid size-6 place-items-center rounded-full bg-foreground text-xs font-bold text-background">
            {n}
          </span>
          <span className="role-title text-[18px]">{title}</span>
        </h2>
        {action}
      </header>
      <div className="mt-5 grid gap-6">{children}</div>
    </section>
  );
}
