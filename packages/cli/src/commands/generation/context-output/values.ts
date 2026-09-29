export function renderContextValue(value: unknown, depth = 0): string {
  if (typeof value === 'string') {
    return value.trim() === '' ? JSON.stringify(value) : value;
  }
  if (Array.isArray(value)) {
    return renderArray(value, depth);
  }
  if (value !== null && typeof value === 'object') {
    return renderContextFields(value as Record<string, unknown>, depth);
  }
  return JSON.stringify(value);
}

export function renderContextFields(fields: Record<string, unknown>, depth = 0): string {
  const entries = Object.entries(fields);
  if (entries.length === 0) {
    return '{}';
  }
  return entries.map(([key, value]) => {
    const text = key === 'voiceIdentity' ? JSON.stringify(value) : renderContextValue(value, depth + 1);
    const separator = value !== null && typeof value === 'object' ? '\n' : ' ';
    return `${'  '.repeat(depth)}${key}:${separator}${text}`;
  }).join('\n');
}

function renderArray(values: unknown[], depth: number): string {
  if (values.length === 0) {
    return '[]';
  }
  return values.map((value, index) => {
    const separator = value !== null && typeof value === 'object' ? '\n' : ' ';
    return `${'  '.repeat(depth)}[${index + 1}]${separator}${renderContextValue(value, depth + 1)}`;
  }).join('\n');
}
