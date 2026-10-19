import {
  createStructuredError,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import type { HeardAboutRenkuAnswer, TelemetryChoice } from '@gorenku/studio-core/client';
import {
  assertHttpRequestFields,
  readHttpRequestRecord,
  readOptionalHttpString,
  readRequiredHttpBoolean,
} from './request-validation.js';

const TELEMETRY_CHOICE_CONTEXT = 'Usage statistics request';

export function readTelemetryChoiceRequest(input: unknown): TelemetryChoice {
  const issues: DiagnosticIssue[] = [];
  const record = readHttpRequestRecord(input, [], issues, TELEMETRY_CHOICE_CONTEXT);
  if (!record) {
    throwTelemetryChoiceRequestError(issues);
  }
  assertHttpRequestFields(
    record,
    [],
    ['enabled', 'heardAbout'],
    issues,
    TELEMETRY_CHOICE_CONTEXT,
    'Send only enabled and heardAbout.'
  );
  const enabled = readRequiredHttpBoolean(record, ['enabled'], issues, TELEMETRY_CHOICE_CONTEXT);
  const heardAbout = readOptionalHttpString(record, ['heardAbout'], issues, TELEMETRY_CHOICE_CONTEXT);
  if (enabled === null || issues.length > 0) {
    throwTelemetryChoiceRequestError(issues);
  }
  // Core validates the answer against the closed list.
  return heardAbout === undefined
    ? { enabled }
    : { enabled, heardAbout: heardAbout as HeardAboutRenkuAnswer };
}

function throwTelemetryChoiceRequestError(issues: DiagnosticIssue[]): never {
  throw createStructuredError({
    code: 'STUDIO_SERVER362',
    message: 'Usage statistics request failed validation.',
    issues,
    suggestion: 'Send { enabled: boolean, heardAbout?: string }.',
  });
}
