import { runGeneration as runEngineGeneration } from '@gorenku/studio-engines';
import { createDiagnosticError } from '@gorenku/studio-diagnostics';
import type {
  GenerationRun,
  GenerationRunReport,
  GenerationSpec,
  JsonValue,
} from '../../client/generation.js';
import type { ProjectRelativePath } from '../../client/project.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import {
  insertGenerationRunRecord,
  readGenerationRunRecord,
} from '../database/access/media-generation.js';
import type { GenerationPurposeContract } from './purpose-contract.js';
import { estimateGeneration } from './estimates.js';
import { validateGenerationSpecForExecution } from './validation.js';

export async function runGeneration(input: {
  id: string;
  specId: string;
  spec: GenerationSpec;
  purpose: GenerationPurposeContract;
  approvalToken: string;
  mode: 'simulated' | 'live';
  session: DatabaseSession;
  projectFolder: string;
  outputRoot?: string;
  outputProjectRelativeRoot?: string;
  now: string;
}): Promise<GenerationRunReport> {
  const estimateReport = await estimateGeneration({
    spec: input.spec,
    purpose: input.purpose,
  });
  if (!estimateReport.valid) {
    return estimateReport;
  }
  if (estimateReport.estimate.approvalToken !== input.approvalToken) {
    return {
      valid: false,
      diagnostics: [createDiagnosticError(
        'CORE_GENERATION_APPROVAL_INVALID',
        'Generation approval does not match the current exact provider request.',
        { path: ['approvalToken'] },
        'Estimate the current request again and approve that exact estimate.'
      )],
    };
  }

  const validation = await validateGenerationSpecForExecution(input);
  if (!validation.valid) {
    return validation;
  }
  const { assembly } = validation.request;
  const baseRun = {
    id: input.id,
    specId: input.specId,
    specSnapshot: structuredClone(input.spec),
    provider: assembly.policy.provider,
    model: assembly.policy.model,
    providerPayload: assembly.payload as Record<string, JsonValue>,
    estimate: estimateReport.estimate,
    startedAt: input.now,
  };
  try {
    const result = await runEngineGeneration({
      policy: assembly.policy,
      request: assembly.request,
      mode: input.mode,
      inputRoot: input.projectFolder,
      outputRoot: input.outputRoot,
      outputProjectRelativeRoot: input.outputProjectRelativeRoot,
    });
    const run = insertGenerationRunRecord(input.session, {
        ...baseRun,
        status: input.mode === 'simulated' ? 'simulated' : 'completed',
        outputs: result.outputs.map((output) => ({
          artifactId: output.artifactId,
          ...(output.mimeType ? { mimeType: output.mimeType } : {}),
          ...(output.projectRelativePath
            ? {
                projectRelativePath:
                  output.projectRelativePath as ProjectRelativePath,
              }
            : {}),
          ...(output.contentHash ? { contentHash: output.contentHash } : {}),
        })),
        receipt: result.receipt as unknown as JsonValue,
        diagnostics: [],
        completedAt: new Date().toISOString(),
    });
    return { valid: true, run, diagnostics: [] };
  } catch (error) {
    const diagnostic = createDiagnosticError(
      'CORE_GENERATION_EXECUTION_FAILED',
      error instanceof Error ? error.message : String(error),
      { path: ['run'] },
      'Review the provider failure and retry only after correcting the request or provider configuration.'
    );
    const run = insertGenerationRunRecord(input.session, {
        ...baseRun,
        status: 'failed',
        outputs: [],
        receipt: null,
        diagnostics: [diagnostic],
        completedAt: new Date().toISOString(),
    });
    return { valid: true, run, diagnostics: [diagnostic] };
  }
}

export function readGenerationRun(input: {
  id: string;
  session: DatabaseSession;
}): GenerationRun | null {
  return readGenerationRunRecord(input.session, input.id);
}
