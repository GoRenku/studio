import { importLocationEnvironmentSheetMedia } from '../../media-generation/purposes/location-environment-sheet.js';
import type { ImageRevisionDestinationDefinition } from '../destination-definition.js';

export const locationEnvironmentSheetRevisionDestination = {
  kind: 'locationEnvironmentSheet',
  async importResult(input) {
    const report = await importLocationEnvironmentSheetMedia({
      projectName: input.projectName,
      homeDir: input.homeDir,
      locationId: input.target.locationId,
      sourceProjectRelativePath: input.outputProjectRelativePath,
      title: input.source.asset.title,
      description:
        input.source.asset.oneLineSummary ?? input.source.asset.title,
      receipt: { run: input.run },
      idGenerator: input.idGenerator,
    });
    const file = report.imported.files.find(
      (candidate) => candidate.mediaKind === 'image',
    );
    if (!file) {
      throw new Error('Imported Location Environment Sheet has no image AssetFile.');
    }
    return {
      imported: { assetId: report.imported.assetId, assetFileId: file.id },
      resourceKeys: report.resourceKeys,
    };
  },
} satisfies ImageRevisionDestinationDefinition<'locationEnvironmentSheet'>;
