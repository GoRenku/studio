import { importCastCharacterSheetMedia } from '../../media-generation/purposes/cast-character-sheet.js';
import type { ImageRevisionDestinationDefinition } from '../destination-definition.js';

export const castCharacterSheetRevisionDestination = {
  kind: 'castCharacterSheet',
  async importResult(input) {
    const report = await importCastCharacterSheetMedia({
      projectName: input.projectName,
      homeDir: input.homeDir,
      castMemberId: input.target.castMemberId,
      sourceProjectRelativePath: input.outputProjectRelativePath,
      title: input.source.asset.title,
      oneLineSummary: input.source.asset.oneLineSummary ?? undefined,
      receipt: { run: input.run },
      idGenerator: input.idGenerator,
    });
    const file = report.imported.files.find(
      (candidate) => candidate.mediaKind === 'image',
    );
    if (!file) {
      throw new Error('Imported Cast Character Sheet has no image AssetFile.');
    }
    return {
      imported: { assetId: report.imported.assetId, assetFileId: file.id },
      resourceKeys: report.resourceKeys,
    };
  },
} satisfies ImageRevisionDestinationDefinition<'castCharacterSheet'>;
