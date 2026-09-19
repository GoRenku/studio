import { StructuredError, createDiagnosticError } from '@gorenku/studio-diagnostics';
import type { MediaModelRoute, PersonalMediaModelLibrary } from './contracts.js';

export const MEDIA_MODEL_LIBRARY_MAX_BYTES = 1024 * 1024;

export function libraryError(code: string, message: string, suggestion?: string) {
  return new StructuredError({ code, message, suggestion });
}

export function parseMediaModelRoute(value: unknown): MediaModelRoute {
  const record = asObject(value);
  const issues = ['provider', 'apiId', 'name'].flatMap((field) => {
    const text = record?.[field];
    return typeof text === 'string' && text.trim().length > 0 && !text.includes('\0')
      ? []
      : [createDiagnosticError('CORE_MEDIA_MODEL_LIBRARY_INVALID',
        `${field} must be a nonempty string without NUL characters.`, { path: [field] })];
  });
  for (const field of Object.keys(record ?? {})) {
    if (!['provider', 'apiId', 'name'].includes(field)) {
      issues.push(createDiagnosticError('CORE_MEDIA_MODEL_LIBRARY_INVALID',
        `Unknown route field: ${field}.`, { path: [field] }));
    }
  }
  if (issues.length) {
    throw new StructuredError({ code: 'CORE_MEDIA_MODEL_LIBRARY_INVALID',
      message: 'Invalid media model route.', issues });
  }
  return { provider: record!.provider as string, apiId: record!.apiId as string,
    name: record!.name as string };
}

export function parseLibraryDocument(contents: string): PersonalMediaModelLibrary {
  const document = asObject(parseLibraryJson(contents));
  if (!document || document.formatVersion !== 1 || !Array.isArray(document.entries)
    || Object.keys(document).some((key) => !['formatVersion', 'entries'].includes(key))) {
    throw libraryError('CORE_MEDIA_MODEL_LIBRARY_INVALID', 'Expected a version 1 personal media model library with entries.');
  }
  const entries = document.entries.map(parseMediaModelRoute);
  assertUniqueRoutes(entries);
  return { formatVersion: 1, entries };
}

export function parseLibraryJson(contents: string): unknown {
  if (Buffer.byteLength(contents, 'utf8') > MEDIA_MODEL_LIBRARY_MAX_BYTES) {
    throw libraryError('CORE_MEDIA_MODEL_LIBRARY_INVALID', 'Media model document exceeds 1 MiB.');
  }
  try {
    return JSON.parse(contents) as unknown;
  } catch {
    throw libraryError('CORE_MEDIA_MODEL_LIBRARY_INVALID', 'Media model document is not valid JSON.');
  }
}

export function routeIdentity(route: { provider: string; apiId: string }): string {
  return JSON.stringify([route.provider, route.apiId]);
}

export function assertUniqueRoutes(routes: MediaModelRoute[]): void {
  const identities = new Set<string>();
  for (const route of routes) {
    const identity = routeIdentity(route);
    if (identities.has(identity)) {
      throw libraryError('CORE_MEDIA_MODEL_LIBRARY_INVALID', `Duplicate media model identity: ${identity}.`);
    }
    identities.add(identity);
  }
}

export function asObject(value: unknown): Record<string, unknown> | null {
  return value !== null && typeof value === 'object' && !Array.isArray(value)
    ? value as Record<string, unknown> : null;
}
