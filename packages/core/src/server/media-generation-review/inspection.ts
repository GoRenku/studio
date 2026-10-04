import type { MediaGenerationPreviewResource } from '../../client/media-generation-review.js';
import type { RenkuConfigPathOptions } from '../config/index.js';
import { withProject } from '../project-operation.js';
import { readAssetFileRecordIncludingDiscarded } from '../database/access/asset-files.js';
import { readProjectRecord } from '../database/access/project.js';
import { ProjectDataError } from '../project-data-error.js';
import { projectLocalMediaReferences } from './local-media.js';
import { projectConfiguration } from './preview.js';

export async function readAssetFileMediaGenerationRequest(
  input: RenkuConfigPathOptions & { projectName?: string; assetFileId: string },
): Promise<MediaGenerationPreviewResource> {
  return withProject(input, async ({ session, projectFolder }) => {
    const assetFile = readAssetFileRecordIncludingDiscarded(session, input.assetFileId);
    if (!assetFile || assetFile.discardedAt || !assetFile.generationProvenance) {
      throw new ProjectDataError(
        'CORE_MEDIA_GENERATION_PROVENANCE_REQUIRED',
        'The Asset does not have saved media generation provenance.',
      );
    }
    const project = readProjectRecord(session);
    if (!project) {
      throw new ProjectDataError('PROJECT_DATA021', 'Project database has no Project row.');
    }
    const provenance = assetFile.generationProvenance;
    const projected = await projectLocalMediaReferences({
      request: provenance.request,
      session,
      projectFolder,
      projectName: project.projectName,
    });
    return {
      kind: 'mediaGenerationPreview',
      provider: provenance.provider,
      model: provenance.model,
      mediaKind: provenance.mediaKind,
      prompt: provenance.prompt,
      references: projected.references,
      configuration: projectConfiguration(provenance.request),
      editable: false,
      diagnostics: projected.diagnostics,
    };
  });
}
