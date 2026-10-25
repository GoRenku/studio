import type { JsonValue } from '../../media/contracts.js';
import { isJsonObject } from '../../shared/json-object.js';

export function normalizeFalOutput(output: JsonValue): string[] {
  if (!isJsonObject(output)) {
    return [];
  }
  const value = isJsonObject(output.data) ? output.data : output;
  const urls: string[] = [];
  for (const key of ['video', 'image', 'audio', 'audio_file']) {
    const url = extractUrl(value[key]);
    if (url) {
      urls.push(url);
    }
  }
  if (Array.isArray(value.images)) {
    for (const image of value.images) {
      const url = extractUrl(image);
      if (url) {
        urls.push(url);
      }
    }
  }
  return urls;
}

function extractUrl(value: JsonValue | undefined): string | undefined {
  return isJsonObject(value) && typeof value.url === 'string' && value.url.length > 0
    ? value.url
    : undefined;
}
