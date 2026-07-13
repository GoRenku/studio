import { createDiagnosticWarning } from '@gorenku/studio-diagnostics';
import type {
  GenerationPreview,
  GenerationReferenceGuide,
  GenerationSpec,
  JsonValue,
} from '../../client/generation.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { resolveGenerationReference } from './references.js';
import type { ValidatedGenerationRequest } from './validation.js';

export async function buildGenerationPreview(input: {
  spec: GenerationSpec;
  referenceGuide: GenerationReferenceGuide;
  session: DatabaseSession;
  projectFolder: string;
  validatedRequest?: ValidatedGenerationRequest;
}): Promise<GenerationPreview> {
  const diagnostics = [];
  const references = [];
  for (const [index, selection] of input.spec.references.entries()) {
    const resolved = await resolveGenerationReference({
      session: input.session,
      projectFolder: input.projectFolder,
      reference: selection.reference,
    });
    if (!resolved) {
      diagnostics.push(createDiagnosticWarning(
        'CORE_GENERATION_REFERENCE_UNAVAILABLE',
        'Saved generation reference is not currently available.',
        { path: ['references', String(index), 'reference'] },
        'Choose an available exact project media file before execution.'
      ));
    }
    references.push({ ...selection, resolved });
  }
  return {
    spec: input.spec,
    referenceGuide: input.referenceGuide,
    references,
    diagnostics,
    ...(input.validatedRequest
      ? {
          providerPayload: input.validatedRequest.assembly.payload as Record<
            string,
            JsonValue
          >,
        }
      : {}),
  };
}
