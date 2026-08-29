import path from 'node:path';
import type { JsonValue } from '../../client/media-generation-review.js';
import { ProjectDataError } from '../project-data-error.js';

const SECRET_FIELD = /^(?:authorization|cookie|set-cookie|api[-_]?key|token|access[-_]?token|secret|credential|password)$/i;
const SIGNED_QUERY_FIELD = /^(?:x-amz-signature|x-amz-credential|signature|sig|token|access_token|key-pair-id|policy)$/i;
const TEMPORARY_MEDIA_HOST = /(?:fal\.media|replicate\.delivery|delivery\.replicate|cdn\.wavespeed\.ai|storage\.googleapis\.com|amazonaws\.com)$/i;

export function assertSafeMediaGenerationRequest(
  value: JsonValue,
  kind: 'review' | 'provenance',
): void {
  visit(value, [], kind, false);
}

export function assertSafeMediaGenerationReceipt(value: JsonValue): void {
  visit(value, [], 'provenance', true);
}

function visit(
  value: JsonValue,
  pathSegments: Array<string | number>,
  kind: 'review' | 'provenance',
  allowProviderMediaUrls: boolean,
): void {
  if (typeof value === 'string') {
    assertSafeString(value, pathSegments, kind, allowProviderMediaUrls);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => visit(
      entry,
      [...pathSegments, index],
      kind,
      allowProviderMediaUrls,
    ));
    return;
  }
  if (value !== null && typeof value === 'object') {
    for (const [key, entry] of Object.entries(value)) {
      if (SECRET_FIELD.test(key)) {
        throw unsafe(kind, `Secret-bearing field is not allowed at ${formatPath([...pathSegments, key])}.`);
      }
      visit(entry, [...pathSegments, key], kind, allowProviderMediaUrls);
    }
  }
}

function assertSafeString(
  value: string,
  pathSegments: Array<string | number>,
  kind: 'review' | 'provenance',
  allowProviderMediaUrls: boolean,
): void {
  if (path.isAbsolute(value) || path.win32.isAbsolute(value)) {
    throw unsafe(kind, `Absolute local path is not allowed at ${formatPath(pathSegments)}.`);
  }
  let url: URL;
  try {
    url = new URL(value);
  } catch {
    return;
  }
  if (url.username || url.password
    || [...url.searchParams.keys()].some((key) => SIGNED_QUERY_FIELD.test(key))) {
    throw unsafe(kind, `Credential-bearing URL is not allowed at ${formatPath(pathSegments)}.`);
  }
  if (!allowProviderMediaUrls && TEMPORARY_MEDIA_HOST.test(url.hostname)) {
    throw unsafe(kind, `Provider transport URL is not allowed at ${formatPath(pathSegments)}.`);
  }
}

function unsafe(kind: 'review' | 'provenance', message: string): ProjectDataError {
  return new ProjectDataError(
    kind === 'review'
      ? 'CORE_MEDIA_GENERATION_REVIEW_UNSAFE'
      : 'CORE_MEDIA_GENERATION_PROVENANCE_UNSAFE',
    message,
  );
}

function formatPath(pathSegments: Array<string | number>): string {
  return pathSegments.length === 0 ? '(root)' : pathSegments.join('.');
}
