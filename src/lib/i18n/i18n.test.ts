import { describe, expect, it } from "vitest";
import english from "./en.json";
import { translate, translateError } from ".";
import { timeAgo } from "@/lib/format";

describe("interface translations", () => {
  it("keeps interpolated user data literal and supports repeated values", () => {
    expect(translate("en", "Quitar {0}", ["Entrada {1} <script>"])).toBe("Remove Entrada {1} <script>");
    expect(translate("es", "Quitar {0}", ["report.txt"])).toBe("Quitar report.txt");
    expect(translate("en", "  Tu texto ")).toBe("  Your text ");
    expect(translate("en", "constructor")).toBe("constructor");
    expect(translate("en", "A model name we do not translate")).toBe("A model name we do not translate");
  });

  it("includes the same parameters in every English message as in its Spanish source", () => {
    const parameters = (text: string) => [...new Set(text.match(/\{\d+\}/g) ?? [])].sort();
    for (const [source, translated] of Object.entries(english)) {
      expect(translated.trim(), source).not.toBe("");
      expect(parameters(translated), source).toEqual(parameters(source));
    }
  });

  it("translates cached worker errors but preserves unknown provider details", () => {
    expect(translateError("en", "Hugging Face respondió HTTP 503.")).toBe("Hugging Face returned HTTP 503.");
    expect(translateError("en", "No se pudo contar con este tokenizador: Repositorio de Hugging Face inválido.")).toBe(
      "Could not count with this tokenizer: Invalid Hugging Face repository.",
    );
    expect(translateError("en", "Anthropic rechazó la clave. Revísala y vuelve a intentar.")).toBe(
      "Anthropic rejected the key. Check it and try again.",
    );
    expect(translateError("en", "NetworkError: upstream message")).toBe("NetworkError: upstream message");
    expect(translateError("es", "Hugging Face respondió HTTP 503.")).toBe("Hugging Face respondió HTTP 503.");
  });

  it("uses the selected language for relative dates", () => {
    const at = "2026-11-21T12:00:00Z";
    const now = Date.parse(at) + 5 * 60_000;
    expect(timeAgo(at, now, "en")).toBe("5 min ago");
    expect(timeAgo(at, now, "es")).toBe("hace 5 min");
  });
});
