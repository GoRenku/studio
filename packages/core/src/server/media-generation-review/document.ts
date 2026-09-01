import type {
  MediaGenerationProvenance,
  MediaGenerationReviewDocument,
} from '../../client/media-generation-review.js';
import type { JsonValue } from '../../client/json.js';
import { ProjectDataError } from '../project-data-error.js';
import { validateMediaGenerationReferenceMarkers } from './local-media.js';

const REVIEW_FIELDS = new Set(['provider', 'model', 'mediaKind', 'prompt', 'request']);
const PROVENANCE_FIELDS = new Set([...REVIEW_FIELDS, 'receipt']);
const MEDIA_KINDS = new Set(['image', 'video', 'audio']);
const MAX_JSON_DEPTH = 64;
const MAX_JSON_BYTES = 2 * 1024 * 1024;

export function parseMediaGenerationReviewDocument(
  value: unknown,
): MediaGenerationReviewDocument {
  const document = parseEnvelope(value, false);
  return document;
}

export function parseMediaGenerationProvenance(
  value: unknown,
): MediaGenerationProvenance {
  const document = parseEnvelope(value, true);
  return {
    ...document,
    ...(isRecord(value) && value.receipt !== undefined
      ? { receipt: requireJsonValue(value.receipt, ['receipt'], true) }
      : {}),
  };
}

function parseEnvelope(
  value: unknown,
  allowReceipt: boolean,
): MediaGenerationReviewDocument {
  if (!isRecord(value)) {
    throw invalid(allowReceipt, 'Media generation data must be a JSON object.');
  }
  const accepted = allowReceipt ? PROVENANCE_FIELDS : REVIEW_FIELDS;
  const unknown = Object.keys(value).filter((key) => !accepted.has(key));
  if (unknown.length > 0) {
    throw invalid(
      allowReceipt,
      `Media generation data contains unknown fields: ${unknown.join(', ')}.`,
    );
  }
  const provider = requireNonEmptyString(value.provider, 'provider', allowReceipt);
  const model = requireNonEmptyString(value.model, 'model', allowReceipt);
  if (typeof value.mediaKind !== 'string' || !MEDIA_KINDS.has(value.mediaKind)) {
    throw invalid(allowReceipt, 'Media generation mediaKind must be image, video, or audio.');
  }
  if (value.prompt !== null && typeof value.prompt !== 'string') {
    throw invalid(allowReceipt, 'Media generation prompt must be a string or null.');
  }
  const request = requireJsonValue(value.request, ['request'], allowReceipt);
  validateMediaGenerationReferenceMarkers(request);
  assertSerializedSize(value, allowReceipt);
  return {
    provider,
    model,
    mediaKind: value.mediaKind as 'image' | 'video' | 'audio',
    prompt: value.prompt,
    request,
  };
}

function requireJsonValue(
  value: unknown,
  path: Array<string | number>,
  provenance: boolean,
  depth = 0,
): JsonValue {
  if (depth > MAX_JSON_DEPTH) {
    throw invalid(provenance, `JSON exceeds maximum depth at ${formatPath(path)}.`);
  }
  if (value === null || typeof value === 'string' || typeof value === 'boolean') {
    return value;
  }
  if (typeof value === 'number') {
    if (Number.isFinite(value)) {
      return value;
    }
    throw invalid(provenance, `JSON number is not finite at ${formatPath(path)}.`);
  }
  if (Array.isArray(value)) {
    return value.map((entry, index) => requireJsonValue(entry, [...path, index], provenance, depth + 1));
  }
  if (isRecord(value)) {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [
        key,
        requireJsonValue(entry, [...path, key], provenance, depth + 1),
      ]),
    );
  }
  throw invalid(provenance, `Non-JSON value at ${formatPath(path)}.`);
}

function assertSerializedSize(value: unknown, provenance: boolean): void {
  const size = Buffer.byteLength(JSON.stringify(value), 'utf8');
  if (size > MAX_JSON_BYTES) {
    throw invalid(provenance, `Media generation JSON exceeds ${MAX_JSON_BYTES} bytes.`);
  }
}

function requireNonEmptyString(
  value: unknown,
  field: string,
  provenance: boolean,
): string {
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw invalid(provenance, `Media generation ${field} must be a non-empty string.`);
  }
  return value;
}

function invalid(provenance: boolean, message: string): ProjectDataError {
  return new ProjectDataError(
    provenance
      ? 'CORE_MEDIA_GENERATION_PROVENANCE_INVALID'
      : 'CORE_MEDIA_GENERATION_REVIEW_INVALID',
    message,
  );
}

function formatPath(path: Array<string | number>): string {
  return path.map(String).join('.');
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
