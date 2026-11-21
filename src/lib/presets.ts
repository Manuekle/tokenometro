import type { WorkloadState } from "./app-state";

export interface Preset {
  id: string;
  label: string;
  /** One line: what the workload represents. */
  blurb: string;
  samples: { name: string; text: string }[];
  workload: Partial<WorkloadState>;
}

/**
 * Starting points for people who do not know their numbers yet. The texts are
 * deliberately realistic (accents, numbers, code, mixed languages): that is
 * where tokenizers disagree the most.
 */
export const PRESETS: Preset[] = [
  {
    id: "support",
    label: "Soporte al cliente",
    blurb: "Chat con política de empresa en el system prompt",
    samples: [
      {
        name: "ticket-facturacion.txt",
        text: `Asunto: Cobro duplicado en mi factura de octubre

Hola, soy Marta Rivas, administradora de la cuenta empresarial 48213. Al revisar la factura de octubre noté que se cobraron dos veces las 25 licencias del plan Business (USD 1.250 en total en lugar de USD 625). Además, la integración con nuestro sistema contable dejó de sincronizar los comprobantes desde el 14 de octubre y aparece el error «TIMEOUT 504» en el panel.

Adjunto capturas de pantalla de ambos casos. ¿Pueden revisar el cobro, confirmar si procede un reembolso y decirme cuándo estará corregida la sincronización? Necesito la respuesta antes del cierre contable del viernes.

Gracias de antemano,
Marta`,
      },
    ],
    workload: {
      requests: 40_000,
      period: "month",
      outputTokens: 250,
      fixedInputTokens: 1_200,
      sampleCopies: 1,
      sampleReusePct: 0,
      cacheHitRate: 90,
      batchShare: 0,
      reasoningTokens: 0,
    },
  },
  {
    id: "contracts",
    label: "Resumen de contratos",
    blurb: "Documentos largos, un resumen por documento",
    samples: [
      {
        name: "clausula-confidencialidad.txt",
        text: `CLÁUSULA OCTAVA. CONFIDENCIALIDAD. Las partes se obligan a mantener en estricta reserva toda la información técnica, comercial y financiera a la que tengan acceso con motivo de la ejecución del presente contrato, y a no divulgarla a terceros sin autorización previa y por escrito de la otra parte. Esta obligación subsistirá durante cinco (5) años contados desde la terminación del contrato, cualquiera que sea la causa.

Quedan exceptuados los datos que sean de dominio público, los que la parte receptora ya conociera legítimamente antes de su divulgación y aquellos cuya revelación sea exigida por mandato judicial o de autoridad competente, en cuyo caso la parte obligada deberá notificar de inmediato a la otra parte.

El incumplimiento de esta cláusula dará lugar a la indemnización de los daños y perjuicios causados, sin perjuicio de las demás acciones legales que correspondan, incluida la solicitud de medidas cautelares para evitar la divulgación o el uso indebido de la información protegida.`,
      },
    ],
    workload: {
      requests: 3_000,
      period: "month",
      outputTokens: 600,
      fixedInputTokens: 500,
      sampleCopies: 12,
      sampleReusePct: 0,
      cacheHitRate: 80,
      batchShare: 50,
      reasoningTokens: 0,
    },
  },
  {
    id: "classify",
    label: "Clasificación masiva",
    blurb: "Muchísimas solicitudes cortas, respuesta mínima",
    samples: [
      {
        name: "resena-producto.txt",
        text: `Pedí la aspiradora robot hace dos semanas. La app es confusa y se desconecta del wifi cada día, pero la succión es buena y la batería dura bastante. Customer service answered in 24h, though they only offered a replacement, not a refund. 3/5.`,
      },
    ],
    workload: {
      requests: 30_000,
      period: "day",
      outputTokens: 30,
      fixedInputTokens: 400,
      sampleCopies: 1,
      sampleReusePct: 0,
      cacheHitRate: 95,
      batchShare: 100,
      reasoningTokens: 0,
    },
  },
  {
    id: "code",
    label: "Asistente de código",
    blurb: "Revisión de código con contexto del repositorio y razonamiento",
    samples: [
      {
        name: "invoice.ts",
        text: `Revisa esta función, encuentra bugs y propón una versión con reintentos.

export async function getInvoice(id: string, opts: { includeLines?: boolean } = {}) {
  const res = await fetch(\`\${process.env.API_URL}/invoices/\${id}\`, {
    headers: { Authorization: \`Bearer \${await getToken()}\` },
    next: { revalidate: 60 },
  });
  if (!res.ok) throw new Error(\`Invoice \${id} failed with \${res.status}\`);
  const invoice = (await res.json()) as Invoice;
  return opts.includeLines ? { ...invoice, lines: await getLines(id) } : invoice;
}
// TODO: add retry with exponential backoff and cache by id`,
      },
    ],
    workload: {
      requests: 6_000,
      period: "month",
      outputTokens: 700,
      fixedInputTokens: 6_000,
      sampleCopies: 4,
      sampleReusePct: 0,
      cacheHitRate: 85,
      batchShare: 0,
      reasoningTokens: 2_000,
    },
  },
];

export const DEFAULT_PRESET = PRESETS[0];
