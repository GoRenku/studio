import { projectMediaGenerationPreview } from '@gorenku/studio-core/server';
import { requiredFlag } from '../structured-command.js';
import type { GenerationCommandInput } from './command.js';
import { loadGenerationRequest } from './request-file.js';
import { validateLoadedGenerationRequest } from './validate.js';
import { deliverGenerationPreviews } from './preview.js';
import { estimateLoadedGenerationRequest } from './estimate.js';

export async function prepareGenerationRequest(input: GenerationCommandInput) {
  const documentPath = requiredFlag(
    typeof input.flags.file === 'string' ? input.flags.file : undefined, '--file',
  );
  const loaded = await loadGenerationRequest({
    file: documentPath,
    projectName: input.runtime.projectName,
    homeDir: input.runtime.homeDir,
    projectDataService: input.runtime.projectDataService,
  });
  const validation = await validateLoadedGenerationRequest(input, loaded);
  const estimate = await estimateLoadedGenerationRequest(input, loaded);
  const preview = await projectMediaGenerationPreview({
    projectName: loaded.projectRef.name,
    homeDir: input.runtime.homeDir,
    documentPath,
    document: loaded.document,
    requestSha256: loaded.requestSha256,
    estimate,
  });
  await deliverGenerationPreviews(input.runtime.homeDir, {
    projectRef: loaded.projectRef,
    previews: [preview],
    source: { kind: 'cli', command: 'generation prepare' },
  });
  return { ...validation, estimate, diagnostics: preview.diagnostics, studio: { delivery: 'delivered' } };
}
