export class GrowthReportError extends Error {
  constructor(code, message, suggestion) {
    super(`${code} ${message}`);
    this.name = 'GrowthReportError';
    this.code = code;
    this.suggestion = suggestion;
  }
}

export function networkFailureText(error) {
  const cause = error?.cause?.code ? ` (${error.cause.code})` : '';
  return `${error instanceof Error ? error.message : 'network error'}${cause}`;
}
