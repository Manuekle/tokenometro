/**
 * Tokenizer families. Pure data + pure functions: safe to import from the
 * server, the client, the worker and tests.
 *
 * A model is mapped to ONE family. Each family says how its tokens are
 * counted and how much we can trust that count:
 *
 *  - exact    : we run the vendor's published tokenizer (OpenAI tiktoken
 *               encodings, open-weight tokenizers from the Hugging Face Hub).
 *  - approx   : nearest published tokenizer (Gemini ~ Gemma).
 *  - estimate : no public tokenizer. Count = o200k count x `ratio`.
 *               Can be calibrated against the vendor's own count API.
 */

export type TokenizerId =
  | "o200k"
  | "cl100k"
  | "qwen"
  | "deepseek"
  | "mistral"
  | "llama3"
  | "llama4"
  | "gemma"
  | "gemini"
  | "claude"
  | "grok"
  | "nova"
  | "cohere"
  | "other";

export type Accuracy = "exact" | "approx" | "estimate";

export type Engine = "tiktoken" | "hf" | "alias" | "ratio";

export interface TokenizerSpec {
  id: TokenizerId;
  /** Short label for the UI. */
  label: string;
  /** Which models use it (UI hint). */
  covers: string;
  engine: Engine;
  /** Accuracy once the engine is available. */
  accuracy: Accuracy;
  /** tiktoken encoding name (engine "tiktoken"). */
  encoding?: "o200k_base" | "cl100k_base";
  /** Hugging Face repo that hosts tokenizer.json (engine "hf"). */
  hfRepo?: string;
  /** Approximate download size in MB (engine "hf"). */
  approxMB?: number;
  /** Counts are taken from this family when it is loaded (engine "alias"). */
  aliasOf?: TokenizerId;
  /**
   * Multiplier applied to the o200k count when no real engine is available.
   * 1 means "assume the same as o200k".
   */
  ratio: number;
  /** Extra explanation shown in the precision panel. */
  note?: string;
}

export const TOKENIZERS: Record<TokenizerId, TokenizerSpec> = {
  o200k: {
    id: "o200k",
    label: "OpenAI o200k",
    covers: "GPT-4o, GPT-4.1, GPT-5/6, o-series, gpt-oss",
    engine: "tiktoken",
    accuracy: "exact",
    encoding: "o200k_base",
    ratio: 1,
    note: "Tokenizador público de OpenAI. Se asume vigente en generaciones nuevas.",
  },
  cl100k: {
    id: "cl100k",
    label: "OpenAI cl100k",
    covers: "GPT-4, GPT-4 Turbo, GPT-3.5",
    engine: "tiktoken",
    accuracy: "exact",
    encoding: "cl100k_base",
    ratio: 1,
  },
  qwen: {
    id: "qwen",
    label: "Qwen",
    covers: "Qwen 2.5 / 3.x",
    engine: "hf",
    accuracy: "exact",
    hfRepo: "Qwen/Qwen2.5-7B-Instruct",
    approxMB: 7,
    ratio: 1,
    note: "Tokenizador oficial de la familia. Versiones nuevas pueden variar un poco.",
  },
  deepseek: {
    id: "deepseek",
    label: "DeepSeek",
    covers: "DeepSeek V3 / R1 / V4",
    engine: "hf",
    accuracy: "exact",
    hfRepo: "deepseek-ai/DeepSeek-V3",
    approxMB: 8,
    ratio: 1,
    note: "Tokenizador de DeepSeek-V3. Versiones nuevas pueden variar un poco.",
  },
  mistral: {
    id: "mistral",
    label: "Mistral (Tekken)",
    covers: "Mistral, Mixtral, Codestral, Devstral",
    engine: "hf",
    accuracy: "exact",
    hfRepo: "mistralai/Mistral-Nemo-Instruct-2407",
    approxMB: 9,
    ratio: 1,
  },
  llama3: {
    id: "llama3",
    label: "Llama 3",
    covers: "Llama 3.x",
    engine: "hf",
    accuracy: "exact",
    hfRepo: "unsloth/Llama-3.2-1B-Instruct",
    approxMB: 17,
    ratio: 1,
    note: "Espejo público del tokenizador oficial de Meta (el original es gated).",
  },
  llama4: {
    id: "llama4",
    label: "Llama 4",
    covers: "Llama 4",
    engine: "hf",
    accuracy: "exact",
    hfRepo: "unsloth/Llama-4-Scout-17B-16E-Instruct",
    approxMB: 28,
    ratio: 1,
    note: "Espejo público del tokenizador oficial de Meta (el original es gated).",
  },
  gemma: {
    id: "gemma",
    label: "Gemma",
    covers: "Gemma 3 / 4",
    engine: "hf",
    accuracy: "exact",
    hfRepo: "unsloth/gemma-3-1b-it",
    approxMB: 33,
    ratio: 1,
    note: "Espejo público del tokenizador de Gemma 3 (el original es gated).",
  },
  gemini: {
    id: "gemini",
    label: "Gemini",
    covers: "Gemini",
    engine: "alias",
    accuracy: "approx",
    aliasOf: "gemma",
    ratio: 1,
    note: "Google no publica el tokenizador de Gemini. Se usa el de Gemma (misma línea). Calibrable con la API de Google.",
  },
  claude: {
    id: "claude",
    label: "Claude",
    covers: "Claude (todas las generaciones)",
    engine: "ratio",
    accuracy: "estimate",
    // Vendor rules of thumb: ~4 chars/token (OpenAI) vs ~3.5 chars/token
    // (Anthropic) => ~1.14x more tokens. A heuristic, not a measurement.
    ratio: 1.14,
    note: "Anthropic no publica su tokenizador. Heurística 3,5 vs 4 caracteres por token. Calibrable con la API de Anthropic.",
  },
  grok: {
    id: "grok",
    label: "Grok",
    covers: "Grok (xAI)",
    engine: "ratio",
    accuracy: "estimate",
    ratio: 1,
    note: "Sin tokenizador público de las versiones actuales. Se asume igual a o200k.",
  },
  nova: {
    id: "nova",
    label: "Amazon Nova",
    covers: "Nova",
    engine: "ratio",
    accuracy: "estimate",
    ratio: 1,
    note: "Sin tokenizador público. Se asume igual a o200k.",
  },
  cohere: {
    id: "cohere",
    label: "Cohere",
    covers: "Command",
    engine: "ratio",
    accuracy: "estimate",
    ratio: 1,
    note: "Sin tokenizador cargado. Se asume igual a o200k.",
  },
  other: {
    id: "other",
    label: "Otros",
    covers: "GLM, Kimi, MiniMax, Muse, Nemotron, etc.",
    engine: "ratio",
    accuracy: "estimate",
    ratio: 1,
    note: "Familias sin tokenizador cargado. Se asume igual a o200k.",
  },
};

/**
 * A tokenizer loaded from ONE model's own Hugging Face repo ("hf:owner/name"),
 * for models whose family has no tokenizer of its own (GLM, Kimi, Nemotron...).
 */
export type RepoEngineId = `hf:${string}`;

/** Anything a worker can load: a family engine or one model's own repo. */
export type EngineId = TokenizerId | RepoEngineId;

const REPO_RE = /^[A-Za-z0-9][\w.-]*\/[A-Za-z0-9][\w.-]*$/;

/**
 * Repo ids come from an external API, so they are validated before they are
 * ever put in a URL: exactly "owner/name", no path tricks.
 */
export function isValidRepo(repo: string | null | undefined): repo is string {
  return typeof repo === "string" && REPO_RE.test(repo) && !repo.includes("..");
}

export const repoEngineId = (repo: string): RepoEngineId => `hf:${repo}`;
export const isRepoEngine = (id: string): id is RepoEngineId => id.startsWith("hf:");
export const repoOfEngine = (id: RepoEngineId): string => id.slice(3);

export const TOKENIZER_IDS = Object.keys(TOKENIZERS) as TokenizerId[];

/** Families whose real engine runs in the worker. */
export const ENGINE_IDS = TOKENIZER_IDS.filter(
  (id) => TOKENIZERS[id].engine === "tiktoken" || TOKENIZERS[id].engine === "hf",
);

/** Families fetched from the Hugging Face Hub (opt-in, big downloads). */
export const HF_IDS = TOKENIZER_IDS.filter((id) => TOKENIZERS[id].engine === "hf");

/**
 * Maps a model to its tokenizer family from OpenRouter's coarse
 * `architecture.tokenizer` label plus the model id.
 */
export function resolveTokenizerId(
  modelId: string,
  orTokenizer: string | null | undefined,
): TokenizerId {
  const slug = (modelId.split("/")[1] ?? "").toLowerCase();
  switch (orTokenizer) {
    case "GPT":
      // GPT-4 / GPT-4 Turbo / GPT-3.5 use cl100k; 4o, 4.1, 5+, o-series use o200k.
      return /^(gpt-4(-|$)|gpt-3\.5)/.test(slug) ? "cl100k" : "o200k";
    case "Claude":
      return "claude";
    case "Gemini":
      return "gemini";
    case "Gemma":
      return "gemma";
    case "Qwen":
    case "Qwen3":
      return "qwen";
    case "DeepSeek":
      return "deepseek";
    case "Mistral":
      return "mistral";
    case "Llama3":
      return "llama3";
    case "Llama4":
      return "llama4";
    case "Grok":
      return "grok";
    case "Nova":
      return "nova";
    case "Cohere":
      return "cohere";
    default:
      return "other";
  }
}
