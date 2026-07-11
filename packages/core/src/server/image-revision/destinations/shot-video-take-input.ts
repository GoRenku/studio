import { requireShotVideoTakeInput } from '../../database/access/shot-video-takes.js';
import { withMediaGenerationProjectSession } from '../../media-generation/lifecycle/project-session.js';
import { importShotInputMedia } from '../../media-generation/purposes/shot-video-take/imports/media-imports.js';
import type { ImageRevisionDestinationDefinition } from '../destination-definition.js';

export const shotVideoTakeInputRevisionDestination = {
  kind: 'shotVideoTakeInput',
  async importResult(input) {
    const sourceInput = await withMediaGenerationProjectSession(
      input,
      ({ session }) => requireShotVideoTakeInput(session, input.target.inputId),
    );
    const report = await importShotInputMedia({
      projectName: input.projectName,
      homeDir: input.homeDir,
      sceneId: input.target.sceneId,
      takeId: input.target.takeId,
      inputKind: sourceInput.kind as never,
      sourceProjectRelativePath: input.outputProjectRelativePath,
      title: sourceInput.title,
      receipt: { run: input.run },
      selection: 'select',
      replaceSelected: true,
      idGenerator: input.idGenerator,
    });
    return {
      imported: {
        assetId: report.mediaInput.assetId,
        assetFileId: report.mediaInput.assetFileId,
      },
      resourceKeys: report.resourceKeys,
    };
  },
} satisfies ImageRevisionDestinationDefinition<'shotVideoTakeInput'>;
