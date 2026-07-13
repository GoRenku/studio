import {
  assembleGenerationProviderRequest,
  type GenerationProviderRequestAssembly,
} from '@gorenku/studio-engines';
import {
  createDiagnosticError,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import type {
  GenerationReferenceCatalogItem,
  GenerationSpec,
  GenerationValidationReport,
} from '../../client/generation.js';
import { createHash } from 'node:crypto';
import { readFile } from 'node:fs/promises';
import { resolveProjectRelativePath } from '../files/project-relative-paths.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import type { GenerationPurposeContract } from './purpose-contract.js';
import { resolveGenerationReference } from './references.js';

export interface ValidatedGenerationRequest {
  spec: GenerationSpec;
  assembly: Extract<GenerationProviderRequestAssembly, { valid: true }>;
  resolvedReferences: GenerationReferenceCatalogItem[];
  referenceContentDigests: string[];
}

export async function validateGenerationSpec(input: {
  spec: GenerationSpec;
  purpose: GenerationPurposeContract;
  session: DatabaseSession;
  projectFolder: string;
}): Promise<GenerationValidationReport> {
  const prepared = await validateGenerationSpecForExecution(input);
  return prepared.valid
    ? { valid: true, spec: input.spec, diagnostics: [] }
    : { valid: false, diagnostics: prepared.diagnostics };
}

export async function validateGenerationSpecForExecution(input: {
  spec: GenerationSpec;
  purpose: GenerationPurposeContract;
  session: DatabaseSession;
  projectFolder: string;
}): Promise<
  | { valid: true; request: ValidatedGenerationRequest; diagnostics: [] }
  | { valid: false; diagnostics: DiagnosticIssue[] }
> {
  const diagnostics: DiagnosticIssue[] = [];
  if (input.spec.purpose !== input.purpose.purpose) {
    diagnostics.push(createDiagnosticError(
      'CORE_GENERATION_ENVELOPE_INVALID',
      `Generation purpose ${input.spec.purpose} does not match ${input.purpose.purpose}.`,
      { path: ['purpose'] },
      `Use purpose ${input.purpose.purpose} for this command.`
    ));
  }
  if (input.spec.target.kind !== input.purpose.targetKind) {
    diagnostics.push(createDiagnosticError(
      'CORE_GENERATION_ENVELOPE_INVALID',
      `Generation purpose ${input.purpose.purpose} requires target kind ${input.purpose.targetKind}, received ${input.spec.target.kind}.`,
      { path: ['target', 'kind'] },
      `Use a ${input.purpose.targetKind} target.`
    ));
  }
  const provider = input.spec.model?.provider?.trim();
  const model = input.spec.model?.model?.trim();
  if (!provider) {
    diagnostics.push(createDiagnosticError(
      'CORE_GENERATION_MODEL_INVALID',
      'Generation provider is required for execution.',
      { path: ['model', 'provider'] },
      'Choose an actual provider endpoint.'
    ));
  }
  if (!model) {
    diagnostics.push(createDiagnosticError(
      'CORE_GENERATION_MODEL_INVALID',
      'Generation model is required for execution.',
      { path: ['model', 'model'] },
      'Choose an actual provider model endpoint.'
    ));
  }

  const resolvedReferences: GenerationReferenceCatalogItem[] = [];
  const referenceContentDigests: string[] = [];
  const providerReferences = [];
  for (const [index, selection] of input.spec.references.entries()) {
    if (!selection.included) {
      continue;
    }
    const resolved = await resolveGenerationReference({
      session: input.session,
      projectFolder: input.projectFolder,
      reference: selection.reference,
    });
    if (!resolved) {
      diagnostics.push(createDiagnosticError(
        'CORE_GENERATION_REFERENCE_INVALID',
        'Generation reference does not resolve to an available safe project media file.',
        { path: ['references', String(index), 'reference'] },
        'Choose an existing exact asset file or project-relative media file.'
      ));
      continue;
    }
    let contentDigest: string;
    try {
      contentDigest = await digestProjectFile(
        input.projectFolder,
        resolved.projectRelativePath
      );
    } catch {
      diagnostics.push(createDiagnosticError(
        'CORE_GENERATION_REFERENCE_INVALID',
        'Generation reference file became unavailable while validating the request.',
        { path: ['references', String(index), 'reference'] },
        'Restore the file or choose another exact project media file.'
      ));
      continue;
    }
    resolvedReferences.push(resolved);
    referenceContentDigests.push(contentDigest);
    providerReferences.push({
      providerField: selection.providerField,
      projectRelativePath: resolved.projectRelativePath,
      mediaKind: resolved.mediaKind,
      sourceIndex: index,
      mimeType: resolved.mimeType,
      sizeBytes: resolved.sizeBytes,
      width: resolved.width,
      height: resolved.height,
      durationSeconds: resolved.durationSeconds,
    });
  }

  if (!provider || !model) {
    return { valid: false, diagnostics };
  }
  const assembly = await assembleGenerationProviderRequest({
    provider,
    model,
    values: input.spec.values,
    references: providerReferences,
  });
  if (assembly.descriptor && assembly.descriptor.mediaKind !== input.purpose.outputMediaKind) {
    diagnostics.push(createDiagnosticError(
      'CORE_GENERATION_OUTPUT_INVALID',
      `Provider model output ${assembly.descriptor.mediaKind} does not match purpose output ${input.purpose.outputMediaKind}.`,
      { path: ['model'] },
      `Choose a provider model that outputs ${input.purpose.outputMediaKind}.`
    ));
  }
  if (!assembly.valid) {
    diagnostics.push(...assembly.issues.map((issue) =>
      createDiagnosticError(
        'ENGINE_GENERATION_PAYLOAD_INVALID',
        issue.message,
        { path: issue.path.split('.') },
        issue.suggestion
      )
    ));
  }
  if (diagnostics.length > 0 || !assembly.valid) {
    return { valid: false, diagnostics };
  }
  return {
    valid: true,
    request: {
      spec: input.spec,
      assembly,
      resolvedReferences,
      referenceContentDigests,
    },
    diagnostics: [],
  };
}

async function digestProjectFile(
  projectFolder: string,
  projectRelativePath: GenerationReferenceCatalogItem['projectRelativePath']
): Promise<string> {
  const contents = await readFile(
    resolveProjectRelativePath(projectFolder, projectRelativePath)
  );
  return `sha256:${createHash('sha256').update(contents).digest('hex')}`;
}
