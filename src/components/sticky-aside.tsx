"use client";

import { useEffect, useRef } from "react";
import { cn } from "cn";
import { nextStickyTop, stickyBounds } from "@/lib/sticky";

/** Space kept above and below the column while it is stuck. Keep in sync with `lg:top-5`. */
const GAP = 20;

/** The two-column layout starts here (Tailwind `lg`). Below it the column is not sticky. */
const WIDE = "(min-width: 1024px)";

/**
 * The left column of the workbench. It follows you while you scroll (`position: sticky`).
 * The CSS alone is enough when the column fits the screen; when it is taller, the
 * effect below moves its `top` with the scroll so that it holds its bottom edge
 * going down and its top edge going up (see `lib/sticky.ts`). Looks are untouched.
 */
export function StickyAside({ className, children }: { className?: string; children: React.ReactNode }) {
  const ref = useRef<HTMLElement>(null);

  useEffect(() => {
    const el = ref.current;
    if (!el) return;

    const wide = window.matchMedia(WIDE);
    let top = GAP;
    let lastY = window.scrollY;
    let height = el.offsetHeight;
    let frame = 0;

    const bounds = () => stickyBounds(window.innerHeight, height, GAP);
    const place = (next: number) => {
      top = next;
      el.style.top = `${next}px`;
    };
    // The column's height or the window's changed: keep `top` inside the new limits.
    const refit = () => {
      height = el.offsetHeight;
      place(nextStickyTop(top, 0, bounds()));
    };
    const onScroll = () => {
      if (frame) return;
      frame = requestAnimationFrame(() => {
        frame = 0;
        const y = window.scrollY;
        place(nextStickyTop(top, y - lastY, bounds()));
        lastY = y;
      });
    };

    const observer = new ResizeObserver(refit);
    const start = () => {
      lastY = window.scrollY;
      refit();
      window.addEventListener("scroll", onScroll, { passive: true });
      window.addEventListener("resize", refit);
      observer.observe(el);
    };
    const stop = () => {
      window.removeEventListener("scroll", onScroll);
      window.removeEventListener("resize", refit);
      observer.disconnect();
      cancelAnimationFrame(frame);
      frame = 0;
      el.style.removeProperty("top");
    };
    const sync = () => (wide.matches ? start() : stop());

    sync();
    wide.addEventListener("change", sync);
    return () => {
      wide.removeEventListener("change", sync);
      stop();
    };
  }, []);

  return (
    <aside ref={ref} className={cn("lg:sticky lg:top-5", className)}>
      {children}
    </aside>
  );
}
