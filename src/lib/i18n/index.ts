import english from "./en.json";
import type { Language } from "@/lib/preferences";

export type MessageValues = readonly (string | number)[];
const messages: Readonly<Record<string, string>> = english;

/** Spanish source messages are the keys. Values are inserted after translation, never translated. */
export function translate(language: Language, source: string, values: MessageValues = []): string {
  const key = source.trim().replace(/\s+/g, " ");
  const translated = language === "en" && Object.hasOwn(messages, key) ? messages[key] : undefined;
  const message =
    translated === undefined
      ? source
      : `${source.match(/^\s*/)?.[0] ?? ""}${translated}${source.match(/\s*$/)?.[0] ?? ""}`;
  return message.replace(/\{(\d+)\}/g, (placeholder, index: string) => String(values[Number(index)] ?? placeholder));
}

// Older worker/probe errors are stored as Spanish strings. Translate only our known error formats;
// provider details and library errors remain literal. This also covers errors restored from Cache Storage.
const errorPatterns = [
  "Hugging Face respondió HTTP {0}.",
  "{0} rechazó la clave. Revísala y vuelve a intentar.",
  "{0} no encontró ese modelo{1}.",
  "{0} limitó las solicitudes. Espera un momento y reintenta.",
  "{0} respondió HTTP {1}.",
  "Este tokenizador no es compatible con el motor del navegador: {0}",
  "No se pudo contar con este tokenizador: {0}",
  '"{0}" no tiene motor de tokenización propio',
].map((source) => ({
  source,
  pattern: new RegExp(`^${source.replace(/[.*+?^${}()|[\]\\]/g, "\\$&").replace(/\\\{\d+\\\}/g, "(.*?)")}$`),
}));

export function translateError(language: Language, message: string): string {
  if (language === "es") return message;
  const direct = translate(language, message);
  if (direct !== message) return direct;
  for (const { source, pattern } of errorPatterns) {
    const match = message.match(pattern);
    if (match)
      return translate(
        language,
        source,
        match.slice(1).map((part) => translateError(language, part)),
      );
  }
  return message;
}
