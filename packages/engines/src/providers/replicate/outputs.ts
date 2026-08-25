export function normalizeReplicateOutput(output: unknown): string[] {
  const values = Array.isArray(output) ? output : [output];
  return values.flatMap((value) => {
    if (typeof value === 'string' && value.length > 0) {
      return [value];
    }
    if (!value || typeof value !== 'object' || !('url' in value)) {
      return [];
    }
    const candidate = typeof value.url === 'function' ? value.url() : value.url;
    if (typeof candidate === 'string') {
      return [candidate];
    }
    if (candidate instanceof URL) {
      return [candidate.href];
    }
    return candidate && typeof candidate === 'object' && 'href' in candidate
      && typeof candidate.href === 'string'
      ? [candidate.href]
      : [];
  });
}
