import { importLookbookSheetMedia } from '../../media-generation/purposes/lookbook-sheet.js';
import type { ImageRevisionDestinationDefinition } from '../destination-definition.js';

export const lookbookSheetRevisionDestination = {
  kind: 'lookbookSheet',
  async importResult(input) {
    const report = await importLookbookSheetMedia({
      projectName: input.projectName,
      homeDir: input.homeDir,
      lookbookId: input.target.lookbookId,
      sourceProjectRelativePath: input.outputProjectRelativePath,
      title: input.source.asset.title,
      oneLineSummary: input.source.asset.oneLineSummary ?? undefined,
      receipt: { run: input.run },
      idGenerator: input.idGenerator,
    });
    const file = report.imported.asset.files.find(
      (candidate) => candidate.mediaKind === 'image',
    );
    if (!file) {
      throw new Error('Imported Lookbook Sheet has no image AssetFile.');
    }
    return {
      imported: {
        assetId: report.imported.asset.assetId,
        assetFileId: file.id,
      },
      resourceKeys: report.resourceKeys,
    };
  },
} satisfies ImageRevisionDestinationDefinition<'lookbookSheet'>;
