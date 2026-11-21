/** A failed HTTP request to Hugging Face, with the status kept for callers. */
export class HttpError extends Error {
  constructor(
    readonly status: number,
    message: string,
  ) {
    super(message);
    this.name = "HttpError";
  }
}

/** What a person should read when Hugging Face answers with `status`. */
export function describeHttp(status: number): string {
  if (status === 401 || status === 403) {
    return "Hugging Face exige acceso a este repositorio (modelo con licencia restringida).";
  }
  if (status === 404) {
    return "El repositorio no publica un tokenizer.json (usa un formato propio).";
  }
  if (status === 429) {
    return "Hugging Face limitó las descargas. Reintenta en unos minutos.";
  }
  return `Hugging Face respondió HTTP ${status}.`;
}
