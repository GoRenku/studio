import { createDiagnosticError, StructuredError, type DiagnosticIssue } from '@gorenku/studio-diagnostics';
import { GENERATION_LANES } from '../../client/generation-lanes.js';
import type {
  DefaultModelListEntry,
  DefaultModelListLanes,
} from '../../client/default-models.js';

export const DEFAULT_MODEL_LIST_FORMAT_VERSION = 1 as const;
export const DEFAULT_MODEL_LIST_MAX_BYTES = 256 * 1024;

const KEBAB_ID = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;
const MODEL_KEY = /^[a-z0-9]+(?:[.-][a-z0-9]+)*$/;

/** The stored copy of the Skill's Default Model List. */
export interface StoredDefaultModelList {
  formatVersion: typeof DEFAULT_MODEL_LIST_FORMAT_VERSION;
  syncedAt: string;
  sha256: string;
  lanes: DefaultModelListLanes;
}

/**
 * Validates only the envelope Studio owns: lane names, entry shape, unique
 * model keys and one recommendation per provider. Model keys and names stay
 * opaque Skill data.
 */
export function parseDefaultModelList(contents: string, source: string): DefaultModelListLanes {
  if (Buffer.byteLength(contents, 'utf8') > DEFAULT_MODEL_LIST_MAX_BYTES) {
    throw invalidList(source, [issue([], `The Default Model List is larger than ${DEFAULT_MODEL_LIST_MAX_BYTES} bytes.`)]);
  }
  return validateDefaultModelList(parseJsonObject(contents, source), source);
}

export function parseStoredDefaultModelList(contents: string, source: string): StoredDefaultModelList {
  const value = parseJsonObject(contents, source);
  if (typeof value.syncedAt !== 'string' || typeof value.sha256 !== 'string') {
    throw invalidList(source, [issue([], 'The stored Default Model List is missing syncedAt or sha256.')]);
  }
  return {
    formatVersion: DEFAULT_MODEL_LIST_FORMAT_VERSION,
    syncedAt: value.syncedAt,
    sha256: value.sha256,
    lanes: validateDefaultModelList(value, source),
  };
}

function parseJsonObject(contents: string, source: string): Record<string, unknown> {
  let value: unknown;
  try {
    value = JSON.parse(contents);
  } catch {
    throw invalidList(source, [issue([], 'The Default Model List must be valid JSON.')]);
  }
  if (!isRecord(value)) {
    throw invalidList(source, [issue([], 'The Default Model List must be a JSON object.')]);
  }
  return value;
}

function validateDefaultModelList(value: Record<string, unknown>, source: string): DefaultModelListLanes {
  const issues: DiagnosticIssue[] = [];
  if (value.formatVersion !== DEFAULT_MODEL_LIST_FORMAT_VERSION) {
    issues.push(issue(['formatVersion'], `formatVersion must be ${DEFAULT_MODEL_LIST_FORMAT_VERSION}.`));
  }
  const lanes = readLanes(value.lanes, issues);
  if (issues.length > 0) {
    throw invalidList(source, issues);
  }
  return lanes;
}

function readLanes(value: unknown, issues: DiagnosticIssue[]): DefaultModelListLanes {
  const lanes = Object.fromEntries(GENERATION_LANES.map((lane) => [lane, []])) as unknown as DefaultModelListLanes;
  if (!isRecord(value)) {
    issues.push(issue(['lanes'], 'lanes must be an object keyed by generation lane.'));
    return lanes;
  }
  for (const key of Object.keys(value)) {
    if (!(GENERATION_LANES as readonly string[]).includes(key)) {
      issues.push(issue(['lanes', key], `Unknown generation lane: ${key}.`));
    }
  }
  for (const lane of GENERATION_LANES) {
    const entries = value[lane];
    if (!Array.isArray(entries)) {
      issues.push(issue(['lanes', lane], `${lane} must be an array of model entries.`));
      continue;
    }
    lanes[lane] = entries.flatMap((entry, index) => readEntry(entry, ['lanes', lane, String(index)], issues));
    checkLaneUniqueness(lanes[lane], ['lanes', lane], issues);
  }
  return lanes;
}

function readEntry(value: unknown, path: string[], issues: DiagnosticIssue[]): DefaultModelListEntry[] {
  if (!isRecord(value)) {
    issues.push(issue(path, 'Each model entry must be an object.'));
    return [];
  }
  const before = issues.length;
  if (typeof value.model !== 'string' || !MODEL_KEY.test(value.model)) {
    issues.push(issue([...path, 'model'], 'model must be a lowercase Skill model guide key.'));
  }
  if (typeof value.name !== 'string' || value.name.trim() === '' || value.name.length > 128) {
    issues.push(issue([...path, 'name'], 'name must be a non-empty display name of at most 128 characters.'));
  }
  const providers = readProviderList(value.providers, [...path, 'providers'], issues);
  const recommendedFor = readProviderList(value.recommendedFor, [...path, 'recommendedFor'], issues, true);
  for (const provider of recommendedFor) {
    if (!providers.includes(provider)) {
      issues.push(issue([...path, 'recommendedFor'], `recommendedFor lists ${provider}, which is not in providers.`));
    }
  }
  if (issues.length > before) {
    return [];
  }
  return [{ model: value.model as string, name: value.name as string, providers, recommendedFor }];
}

function readProviderList(value: unknown, path: string[], issues: DiagnosticIssue[], allowEmpty = false): string[] {
  if (!Array.isArray(value) || (!allowEmpty && value.length === 0)) {
    issues.push(issue(path, allowEmpty ? 'Must be an array of provider ids.' : 'Must be a non-empty array of provider ids.'));
    return [];
  }
  const providers = value.filter((provider): provider is string => typeof provider === 'string' && KEBAB_ID.test(provider));
  if (providers.length !== value.length || new Set(providers).size !== providers.length) {
    issues.push(issue(path, 'Provider ids must be unique kebab-case strings.'));
  }
  return providers;
}

function checkLaneUniqueness(entries: DefaultModelListEntry[], path: string[], issues: DiagnosticIssue[]): void {
  const models = new Set<string>();
  const recommended = new Set<string>();
  for (const entry of entries) {
    if (models.has(entry.model)) {
      issues.push(issue(path, `Model ${entry.model} is listed more than once.`));
    }
    models.add(entry.model);
    for (const provider of entry.recommendedFor) {
      if (recommended.has(provider)) {
        issues.push(issue(path, `Provider ${provider} has more than one recommendation.`));
      }
      recommended.add(provider);
    }
  }
}

function issue(path: string[], message: string): DiagnosticIssue {
  return createDiagnosticError('DEFAULT_MODELS001', message, { path, context: 'Default Model List' });
}

function invalidList(source: string, issues: DiagnosticIssue[]): StructuredError {
  return new StructuredError({
    code: 'DEFAULT_MODELS001',
    message: `The Default Model List at ${source} is invalid.`,
    issues,
    suggestion: 'Fix the Default Model List in the Renku skills, then sync it again.',
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === 'object' && !Array.isArray(value);
}
