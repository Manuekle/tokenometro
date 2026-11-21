const LABELS: Record<string, string> = {
  openai: "OpenAI",
  anthropic: "Anthropic",
  google: "Google",
  "x-ai": "xAI",
  meta: "Meta",
  "meta-llama": "Meta",
  mistralai: "Mistral",
  deepseek: "DeepSeek",
  qwen: "Alibaba (Qwen)",
  "z-ai": "Z.ai (GLM)",
  moonshotai: "Moonshot (Kimi)",
  amazon: "Amazon",
  cohere: "Cohere",
  nvidia: "NVIDIA",
  minimax: "MiniMax",
  perplexity: "Perplexity",
  tencent: "Tencent",
  xiaomi: "Xiaomi",
  baidu: "Baidu",
  microsoft: "Microsoft",
  ibm: "IBM",
  liquid: "Liquid AI",
  inclusionai: "inclusionAI",
  thinkingmachines: "Thinking Machines",
  "aion-labs": "AionLabs",
  stepfun: "StepFun",
  bytedance: "ByteDance",
};

function titleCase(slug: string): string {
  return slug
    .split(/[-_]/)
    .filter(Boolean)
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(" ");
}

export function vendorLabel(slug: string): string {
  return LABELS[slug] ?? titleCase(slug);
}
