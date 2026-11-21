import Image from "next/image";
import { Sym } from "@/components/sym";
import icon from "../../public/icons/icon-192.png";

/** Where the numbers come from. Same sources the "Cómo se calcula" dialog describes. */
const SOURCES = [
  { name: "OpenRouter", what: "modelos y precios", href: "https://openrouter.ai/models" },
  { name: "Artificial Analysis", what: "índice de inteligencia", href: "https://artificialanalysis.ai" },
  { name: "Hugging Face", what: "tokenizadores", href: "https://huggingface.co" },
] as const;

/** Plain inline flow on purpose: the spaces between the words are real, so a screen reader announces them. */
function External({ href, name, what }: { href: string; name: string; what: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="group/link rounded-md outline-none focus-visible:ring-[3px] focus-visible:ring-ring/45"
    >
      <span className="font-semibold text-foreground">{name}</span> <span className="text-muted-foreground">{what}</span>{" "}
      <Sym className="text-xs text-faint transition-transform group-hover/link:translate-x-0.5 group-hover/link:-translate-y-0.5">
        ↗
      </Sym>
    </a>
  );
}

export function SiteFooter() {
  return (
    <footer className="mx-auto mt-auto w-full max-w-[1440px] px-5 pb-6 sm:px-8 sm:pb-8">
      <div className="grid gap-10 rounded-[32px] bg-card p-6 sm:p-10 lg:grid-cols-[minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)]">
        <div className="grid content-start gap-5">
          <p className="flex items-center gap-3">
            {/* A static import, so the build puts the base path in front (a "/icons/…" string would not get it). */}
            <Image src={icon} alt="" width={44} height={44} unoptimized className="size-11 rounded-[13px]" />
            <span className="role-display text-[26px] leading-none">
              Tokenómetro<span className="text-blue">.</span>
            </span>
          </p>
          <p className="max-w-md text-sm leading-relaxed text-pretty text-muted-foreground">
            Compara cuánto cuesta tu texto en cada modelo de IA, con el tokenizador real de cada uno y tu propia carga
            de trabajo.
          </p>
          {/* rounded-2xl, not -full: on a phone the sentence wraps and a full pill would look like a lozenge. */}
          <p className="flex w-fit items-center gap-2 rounded-2xl bg-signal-soft px-3.5 py-1.5 text-xs font-semibold text-signal-ink">
            <Sym>✓</Sym> Tu texto no pasa por ningún servidor nuestro
          </p>
        </div>

        <section aria-labelledby="footer-sources" className="grid content-start gap-3">
          <h2 id="footer-sources" className="role-label text-muted-foreground">
            De dónde salen los datos
          </h2>
          <ul className="grid gap-2.5 text-sm">
            {SOURCES.map((source) => (
              <li key={source.name}>
                <External {...source} />
              </li>
            ))}
          </ul>
        </section>

        <section aria-labelledby="footer-credits" className="grid content-start gap-3">
          <h2 id="footer-credits" className="role-label text-muted-foreground">
            Créditos
          </h2>
          <ul className="grid gap-2.5 text-sm">
            <li>
              <External href="https://allo.joshpuckett.me" name="Allo" what="tipografía de Josh Puckett" />
            </li>
            <li className="text-muted-foreground">Licencia OFL 1.1</li>
          </ul>
        </section>
      </div>

      <p className="mt-5 max-w-3xl px-2 text-xs leading-relaxed text-muted-foreground sm:px-4">
        Precios de lista, sin descuentos ni impuestos. Los conteos estimados pueden variar unos puntos frente al
        tokenizador real de cada modelo: valida con tus propios casos. Los nombres y las marcas de los modelos
        pertenecen a sus dueños.
      </p>
    </footer>
  );
}
