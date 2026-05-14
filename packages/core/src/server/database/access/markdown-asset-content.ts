import {
  readAssetFileRecord,
  type AssetFileRecord,
} from './asset-files.js';
import { readAssetRecord } from './assets.js';
import { ProjectDataError } from '../../project-data-error.js';
import type { DatabaseSession } from '../lifecycle/store.js';

export function readMarkdownAssetFileRecord(
  session: DatabaseSession,
  input: { assetId: string; assetFileId: string }
): AssetFileRecord {
  const asset = readAssetRecord(session, input.assetId);
  if (!asset) {
    throw new ProjectDataError(
      'PROJECT_DATA069',
      `Markdown asset ${input.assetId} was not found.`
    );
  }
  if (asset.mediaKind !== 'text' && asset.mediaKind !== 'markdown') {
    throw new ProjectDataError(
      'PROJECT_DATA070',
      `Asset ${input.assetId} is not a Markdown text asset.`
    );
  }

  const file = readAssetFileRecord(session, input);
  if (!file) {
    throw new ProjectDataError(
      'PROJECT_DATA071',
      `Markdown asset file ${input.assetFileId} was not found for asset ${input.assetId}.`
    );
  }
  if (file.role !== 'primary') {
    throw new ProjectDataError(
      'PROJECT_DATA072',
      `Markdown asset file ${input.assetFileId} is not the primary text file.`
    );
  }
  if (file.mediaKind !== 'text' && file.mediaKind !== 'markdown') {
    throw new ProjectDataError(
      'PROJECT_DATA073',
      `Asset file ${input.assetFileId} is not a Markdown text file.`
    );
  }

  return file;
}
