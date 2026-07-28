import {
  createDiagnosticError,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import type {
  ScenePanelTab,
  StudioSelection,
} from '../../client/index.js';

const SCENE_PANEL_TABS: ScenePanelTab[] = [
  'narrative',
  'beats',
  'shotPlans',
];

export type StudioSelectionParseResult =
  | { valid: true; selection: StudioSelection }
  | { valid: false; issues: DiagnosticIssue[] };

export function parseStudioSelection(
  value: unknown,
  options: {
    path?: string[];
    context?: string;
  } = {}
): StudioSelectionParseResult {
  const path = options.path ?? [];
  const context = options.context ?? 'studio selection';
  const issues: DiagnosticIssue[] = [];
  const record = readRecord(value);
  if (!record) {
    return invalidSelection([
      selectionIssue(
        'STUDIO_COORDINATION005',
        'Movie Studio selection must be an object.',
        path,
        context
      ),
    ]);
  }

  const type = record.type;
  if (typeof type !== 'string' || !type.trim()) {
    return invalidSelection([
      selectionIssue(
        'STUDIO_COORDINATION005',
        'Movie Studio selection type must be a non-empty string.',
        [...path, 'type'],
        context
      ),
    ]);
  }

  let selection: StudioSelection | null = null;
  switch (type) {
    case 'projectInformation':
    case 'trash':
    case 'cast':
    case 'locations':
    case 'storyArc':
      validateFields(record, ['type'], path, context, issues);
      selection = { type };
      break;
    case 'inspiration': {
      validateFields(record, ['type', 'folderId'], path, context, issues);
      const folderId = readOptionalString(
        record,
        'folderId',
        path,
        context,
        issues
      );
      selection = folderId === undefined ? { type } : { type, folderId };
      break;
    }
    case 'lookbook':
      validateFields(record, ['type', 'kind'], path, context, issues);
      if (record.kind !== 'production' && record.kind !== 'storyboard') {
        issues.push(
          selectionIssue(
            'STUDIO_COORDINATION005',
            'Lookbook selection kind must be production or storyboard.',
            [...path, 'kind'],
            context
          )
        );
      } else {
        selection = { type, kind: record.kind };
      }
      break;
    case 'act':
    case 'sequence':
    case 'castMember':
    case 'location': {
      validateFields(record, ['type', 'id'], path, context, issues);
      const id = readRequiredString(record, 'id', path, context, issues);
      if (id !== null) {
        selection = { type, id };
      }
      break;
    }
    case 'scene': {
      validateFields(
        record,
        ['type', 'id', 'sceneTab', 'beatId', 'shotPlanId', 'shotId'],
        path,
        context,
        issues,
        'STUDIO_COORDINATION037'
      );
      const id = readRequiredString(record, 'id', path, context, issues);
      const sceneTab = readScenePanelTab(record, path, context, issues);
      const beatId = readOptionalString(
        record,
        'beatId',
        path,
        context,
        issues
      );
      const shotPlanId = readOptionalString(
        record,
        'shotPlanId',
        path,
        context,
        issues
      );
      const shotId = readOptionalString(
        record,
        'shotId',
        path,
        context,
        issues
      );
      if (beatId && sceneTab !== 'beats') {
        issues.push(
          selectionIssue(
            'STUDIO_COORDINATION036',
            'Beat focus requires the Beats scene tab.',
            [...path, 'sceneTab'],
            context
          )
        );
      }
      if (shotPlanId && sceneTab !== 'shotPlans') {
        issues.push(
          selectionIssue(
            'STUDIO_COORDINATION039',
            'Shot Plan focus requires the Shot Plans scene tab.',
            [...path, 'sceneTab'],
            context
          )
        );
      }
      if (shotId && !shotPlanId) {
        issues.push(
          selectionIssue(
            'STUDIO_COORDINATION040',
            'Shot focus requires a Shot Plan.',
            [...path, 'shotPlanId'],
            context
          )
        );
      }
      if (id !== null) {
        selection = {
          type,
          id,
          ...(sceneTab ? { sceneTab } : {}),
          ...(beatId ? { beatId } : {}),
          ...(shotPlanId ? { shotPlanId } : {}),
          ...(shotId ? { shotId } : {}),
        };
      }
      break;
    }
    default:
      issues.push(
        selectionIssue(
          'STUDIO_COORDINATION005',
          `Unsupported Movie Studio selection type: ${type}.`,
          [...path, 'type'],
          context
        )
      );
  }

  return issues.length === 0 && selection
    ? { valid: true, selection }
    : invalidSelection(issues);
}

function readScenePanelTab(
  record: Record<string, unknown>,
  path: string[],
  context: string,
  issues: DiagnosticIssue[]
): ScenePanelTab | undefined {
  if (record.sceneTab === undefined) {
    return undefined;
  }
  if (
    typeof record.sceneTab !== 'string' ||
    !SCENE_PANEL_TABS.includes(record.sceneTab as ScenePanelTab)
  ) {
    issues.push(
      selectionIssue(
        'STUDIO_COORDINATION036',
        'Unsupported scene tab.',
        [...path, 'sceneTab'],
        context
      )
    );
    return undefined;
  }
  return record.sceneTab as ScenePanelTab;
}

function readRequiredString(
  record: Record<string, unknown>,
  field: string,
  path: string[],
  context: string,
  issues: DiagnosticIssue[]
): string | null {
  const value = record[field];
  if (typeof value !== 'string' || !value.trim()) {
    issues.push(
      selectionIssue(
        'STUDIO_COORDINATION005',
        `selection.${field} must be a non-empty string.`,
        [...path, field],
        context
      )
    );
    return null;
  }
  return value;
}

function readOptionalString(
  record: Record<string, unknown>,
  field: string,
  path: string[],
  context: string,
  issues: DiagnosticIssue[]
): string | undefined {
  const value = record[field];
  if (value === undefined) {
    return undefined;
  }
  if (typeof value !== 'string' || !value.trim()) {
    issues.push(
      selectionIssue(
        'STUDIO_COORDINATION005',
        `selection.${field} must be a non-empty string when provided.`,
        [...path, field],
        context
      )
    );
    return undefined;
  }
  return value;
}

function validateFields(
  record: Record<string, unknown>,
  supportedFields: string[],
  path: string[],
  context: string,
  issues: DiagnosticIssue[],
  code = 'STUDIO_COORDINATION005'
): void {
  for (const field of Object.keys(record)) {
    if (!supportedFields.includes(field)) {
      issues.push(
        selectionIssue(
          code,
          'Unsupported Movie Studio selection field.',
          [...path, field],
          context
        )
      );
    }
  }
}

function readRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function invalidSelection(
  issues: DiagnosticIssue[]
): StudioSelectionParseResult {
  return { valid: false, issues };
}

function selectionIssue(
  code: string,
  message: string,
  path: string[],
  context: string
): DiagnosticIssue {
  return createDiagnosticError(code, message, { path, context });
}
