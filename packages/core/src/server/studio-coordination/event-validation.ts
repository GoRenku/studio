import { createDiagnosticError, type DiagnosticIssue } from '@gorenku/studio-diagnostics';
import { StudioCoordinationError } from './errors.js';
import {
  STUDIO_COORDINATION_EVENT_VERSION,
  type StudioSelection,
  type StudioEvent,
  type StudioEventSource,
  type StudioProjectRef,
} from './events.js';

export function validateStudioEvent(value: unknown): StudioEvent {
  const issues = collectStudioEventIssues(value);
  if (issues.length > 0) {
    throw new StudioCoordinationError(
      'STUDIO_COORDINATION003',
      'Studio coordination event failed validation.',
      {
        issues,
        suggestion: 'Append only supported studio.* coordination event payloads.',
      }
    );
  }
  return value as StudioEvent;
}

export function collectStudioEventIssues(value: unknown) {
  const issues: DiagnosticIssue[] = [];
  const record = readRecord(value);
  if (!record) {
    issues.push(issue('STUDIO_COORDINATION003', 'Studio event must be an object.', []));
    return issues;
  }

  requireString(record, 'id', issues);
  if (record.version !== STUDIO_COORDINATION_EVENT_VERSION) {
    issues.push(
      issue(
        'STUDIO_COORDINATION004',
        `Studio event version must be ${STUDIO_COORDINATION_EVENT_VERSION}.`,
        ['version']
      )
    );
  }
  requireString(record, 'createdAt', issues);
  validateSource(record.source, ['source'], issues);

  switch (record.type) {
    case 'studio.projectRefreshRequested':
      validateProjectRef(record.projectRef, ['projectRef'], issues);
      if (record.surface !== 'projectInformation' && record.surface !== 'projectLibrary') {
        issues.push(issue('STUDIO_COORDINATION005', 'Unsupported refresh surface.', ['surface']));
      }
      break;
    case 'studio.projectResourcesChanged':
      validateProjectRef(record.projectRef, ['projectRef'], issues);
      if (!Array.isArray(record.resourceKeys)) {
        issues.push(issue('STUDIO_COORDINATION005', 'resourceKeys must be an array.', ['resourceKeys']));
      } else {
        for (const [index, resourceKey] of record.resourceKeys.entries()) {
          if (typeof resourceKey !== 'string' || !resourceKey.trim()) {
            issues.push(
              issue(
                'STUDIO_COORDINATION005',
                'resourceKeys entries must be non-empty strings.',
                ['resourceKeys', String(index)]
              )
            );
          }
        }
      }
      break;
    case 'studio.focusRequested':
      validateOptionalProjectRef(record.projectRef, ['projectRef'], issues);
      validateFocus(record.focus, ['focus'], issues);
      break;
    case 'studio.focusChanged':
      validateOptionalProjectRef(record.projectRef, ['projectRef'], issues);
      validateFocus(record.focus, ['focus'], issues);
      if (record.appliedRequestId !== undefined && typeof record.appliedRequestId !== 'string') {
        issues.push(issue('STUDIO_COORDINATION005', 'appliedRequestId must be a string.', ['appliedRequestId']));
      }
      break;
    case 'studio.focusRequestFailed':
      requireString(record, 'requestEventId', issues);
      if (
        record.reason !== 'projectNotFound' &&
        record.reason !== 'projectRefMismatch' &&
        record.reason !== 'selectionNotFound' &&
        record.reason !== 'unsupportedSelection'
      ) {
        issues.push(issue('STUDIO_COORDINATION005', 'Unsupported focus request failure reason.', ['reason']));
      }
      if (!Array.isArray(record.diagnostics)) {
        issues.push(issue('STUDIO_COORDINATION005', 'diagnostics must be an array.', ['diagnostics']));
      }
      break;
    case 'studio.browserSessionActive':
      requireString(record, 'browserSessionId', issues);
      break;
    default:
      issues.push(issue('STUDIO_COORDINATION005', 'Unsupported Studio coordination event type.', ['type']));
  }

  return issues;
}

function validateFocus(value: unknown, path: string[], issues: ReturnType<typeof collectStudioEventIssues>): void {
  const focus = readRecord(value);
  if (!focus) {
    issues.push(issue('STUDIO_COORDINATION005', 'focus must be an object.', path));
    return;
  }
  if (focus.screen === 'projectLibrary') {
    return;
  }
  if (focus.screen === 'movieStudio') {
    validateSelection(focus.selection, [...path, 'selection'], issues);
    return;
  }
  issues.push(issue('STUDIO_COORDINATION005', 'Unsupported Studio focus screen.', [...path, 'screen']));
}

function validateSelection(value: unknown, path: string[], issues: ReturnType<typeof collectStudioEventIssues>): void {
  const selection = readRecord(value) as StudioSelection | null;
  if (!selection) {
    issues.push(issue('STUDIO_COORDINATION005', 'Movie Studio selection must be an object.', path));
    return;
  }
  if (
    selection.type === 'projectInformation' ||
    selection.type === 'visualLanguage' ||
    selection.type === 'storyboard' ||
    selection.type === 'casting'
  ) {
    return;
  }
  if (
    (selection.type === 'sequence' ||
      selection.type === 'scene' ||
      selection.type === 'cast') &&
    typeof selection.id === 'string' &&
    selection.id.trim()
  ) {
    return;
  }
  issues.push(issue('STUDIO_COORDINATION005', 'Unsupported Movie Studio selection.', path));
}

function validateOptionalProjectRef(value: unknown, path: string[], issues: ReturnType<typeof collectStudioEventIssues>): void {
  if (value === undefined) {
    return;
  }
  validateProjectRef(value, path, issues);
}

function validateProjectRef(value: unknown, path: string[], issues: ReturnType<typeof collectStudioEventIssues>): void {
  const ref = readRecord(value) as StudioProjectRef | null;
  if (!ref) {
    issues.push(issue('STUDIO_COORDINATION005', 'projectRef must be an object.', path));
    return;
  }
  for (const key of ['name', 'id', 'storageRoot'] as const) {
    if (typeof ref[key] !== 'string' || !ref[key].trim()) {
      issues.push(issue('STUDIO_COORDINATION005', `projectRef.${key} must be a string.`, [...path, key]));
    }
  }
}

function validateSource(value: unknown, path: string[], issues: ReturnType<typeof collectStudioEventIssues>): void {
  const source = readRecord(value) as StudioEventSource | null;
  if (!source) {
    issues.push(issue('STUDIO_COORDINATION005', 'source must be an object.', path));
    return;
  }
  if (source.kind === 'cli' && typeof source.command === 'string') {
    return;
  }
  if (source.kind === 'agent') {
    return;
  }
  if (source.kind === 'studio') {
    return;
  }
  issues.push(issue('STUDIO_COORDINATION005', 'Unsupported Studio event source.', path));
}

function requireString(
  record: Record<string, unknown>,
  key: string,
  issues: ReturnType<typeof collectStudioEventIssues>
): void {
  if (typeof record[key] !== 'string' || !record[key]) {
    issues.push(issue('STUDIO_COORDINATION005', `${key} must be a string.`, [key]));
  }
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function issue(code: string, message: string, path: string[]) {
  return createDiagnosticError(
    code,
    message,
    { path, context: 'studio coordination event' }
  );
}
