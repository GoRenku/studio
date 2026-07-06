export function providerPreviewPromptText(
  payload: Record<string, unknown>,
  fallback: string
): string {
  if (typeof payload.prompt === 'string') {
    return payload.prompt;
  }
  return multiPromptPreviewText(payload.multi_prompt) ?? fallback;
}

function multiPromptPreviewText(value: unknown): string | null {
  if (!Array.isArray(value)) {
    return null;
  }
  const segments = value.flatMap((entry, index) => {
    const record = readRecord(entry);
    if (!record || typeof record.prompt !== 'string') {
      return [];
    }
    const prompt = record.prompt.trim();
    if (!prompt) {
      return [];
    }
    const duration = durationLabel(record.duration);
    return [`Shot ${index + 1}${duration}: ${prompt}`];
  });
  return segments.length > 0 ? segments.join('\n\n') : null;
}

function readRecord(value: unknown): Record<string, unknown> | null {
  return value && typeof value === 'object' && !Array.isArray(value)
    ? (value as Record<string, unknown>)
    : null;
}

function durationLabel(value: unknown): string {
  if (typeof value === 'number' && Number.isFinite(value)) {
    return ` (duration: ${value})`;
  }
  if (typeof value === 'string' && value.trim()) {
    return ` (duration: ${value.trim()})`;
  }
  return '';
}
