import type { JsonValue } from '../media/contracts.js';

export interface ImageMegapixelGuess {
  megapixels: number;
  /** Plain words saying what the guess was based on. */
  basis: string;
}

/** Request fields that commonly carry an output size label such as "2k", "1080p" or "1024x768". */
const SIZE_LABEL_FIELDS = ['resolution', 'image_size', 'size'];

/** Assumed when a request says nothing about its output size. */
const ASSUMED_MEGAPIXELS = 1;

/**
 * Guesses one output image's size in megapixels from common request fields.
 * It knows no model: it reads width and height, or a size label. A label like
 * "2k" counts as 2 × 2 = 4 megapixels, "1080p" as a 16:9 frame 1080 pixels
 * tall, and "512sq" or "768" as a square. Anything else assumes 1 megapixel.
 */
export function guessImageMegapixels(request: JsonValue): ImageMegapixelGuess {
  const fields = isRecord(request) ? request : {};
  const fromWidthHeight = readWidthHeight(fields) ?? (isRecord(fields.image_size) ? readWidthHeight(fields.image_size) : undefined);
  if (fromWidthHeight) {return fromWidthHeight;}
  for (const field of SIZE_LABEL_FIELDS) {
    const label = fields[field];
    const megapixels = typeof label === 'string' ? readSizeLabel(label) : undefined;
    if (megapixels !== undefined) {
      return { megapixels: round(megapixels), basis: `guessed from ${field} "${label}"` };
    }
  }
  return { megapixels: ASSUMED_MEGAPIXELS, basis: 'the request names no size, so 1 megapixel is assumed' };
}

function readWidthHeight(fields: Record<string, JsonValue>): ImageMegapixelGuess | undefined {
  const { width, height } = fields;
  if (!isPositive(width) || !isPositive(height)) {return undefined;}
  return { megapixels: round((width * height) / 1e6), basis: `${width} × ${height} pixels` };
}

function readSizeLabel(label: string): number | undefined {
  const text = label.trim().toLowerCase();
  const pixels = /^(\d+)\s*[x×*]\s*(\d+)$/.exec(text);
  if (pixels) {return (Number(pixels[1]) * Number(pixels[2])) / 1e6;}
  const megapixels = /^(\d+(?:\.\d+)?)\s*mp$/.exec(text);
  if (megapixels) {return Number(megapixels[1]);}
  const thousands = /^(\d+(?:\.\d+)?)k$/.exec(text);
  if (thousands) {return Number(thousands[1]) ** 2;}
  const videoLines = /^(\d+)p$/.exec(text);
  if (videoLines) {return (Number(videoLines[1]) ** 2 * 16) / 9 / 1e6;}
  const square = /^(\d+)(?:sq|px)?$/.exec(text);
  if (square && Number(square[1]) >= 64) {return Number(square[1]) ** 2 / 1e6;}
  return undefined;
}

function round(megapixels: number): number {
  return Math.round(megapixels * 100) / 100;
}

function isPositive(value: JsonValue | undefined): value is number {
  return typeof value === 'number' && Number.isFinite(value) && value > 0;
}

function isRecord(value: JsonValue | undefined): value is Record<string, JsonValue> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
