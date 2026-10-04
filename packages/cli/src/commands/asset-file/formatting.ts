import type { AssetFilePage, AssetFileUpdateReport, AssetFileSelectionReport } from '@gorenku/studio-core/client';
import type { RunAssetFileCommandOptions } from './types.js';
import { formatOwner } from './parsing.js';

export function writeAssetFileMutation(
  options: RunAssetFileCommandOptions,
  report: AssetFileUpdateReport,
  message: string
): void {
  if (options.json) {
    options.io.stdout.log(JSON.stringify(report, null, 2));
    return;
  }
  options.io.stdout.log(message);
  options.io.stdout.log(`Owner: ${formatOwner(report.assetFile.owner)}`);
}

export function writeSelectionMutation(
  options: RunAssetFileCommandOptions,
  report: AssetFileSelectionReport,
  message: string
): void {
  if (options.json) {
    options.io.stdout.log(JSON.stringify(report, null, 2));
    return;
  }
  options.io.stdout.log(
    report.selectedAssetFileId
      ? `${message}: ${report.selectedAssetFileId}`
      : message
  );
}

export function writeAssetFileList(options: RunAssetFileCommandOptions, page: AssetFilePage): void {
  if (options.json) {
    options.io.stdout.log(JSON.stringify(page, null, 2));
    return;
  }
  if (page.items.length === 0) {
    options.io.stdout.log('No Assets found.');
    return;
  }
  for (const assetFile of page.items) {
    options.io.stdout.log(
      `${assetFile.id} ${assetFile.type}${assetFile.id === page.selectedAssetFileId ? ' (selected)' : ''}`
    );
  }
  if (page.nextCursor) {
    options.io.stdout.log(`Next cursor: ${page.nextCursor}`);
  }
}

