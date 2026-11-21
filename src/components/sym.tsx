import { cn } from "cn";

/**
 * Allo ships interface symbols as ordinary Unicode glyphs, so they take the
 * font's weight, roundness and color like text does. Decorative by default.
 *
 * Used here: ⌕ search · ✕ close · ✓ check · ★ star · ⌄ chevron · ↑ ↓ → ↗ ↘ arrows
 *            ⚠ warning · ● ○ dots · + plus · ⌫ delete · ↻ refresh · ❮ ❯ pager
 */
export function Sym({
  children,
  className,
  label,
}: {
  children: string;
  className?: string;
  /** Provide when the symbol carries meaning on its own. */
  label?: string;
}) {
  return (
    <span
      className={cn("sym", className)}
      {...(label ? { role: "img", "aria-label": label } : { "aria-hidden": true })}
    >
      {children}
    </span>
  );
}
