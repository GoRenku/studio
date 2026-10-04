import fs from 'node:fs/promises';
import { StructuredError } from '@gorenku/studio-diagnostics';
import { createProjectDataService } from '@gorenku/studio-core/server';
import type { ImportReferenceFilesInput } from '@gorenku/studio-core/client';
import type { RunAssetFileCommandOptions } from './types.js';
import { requiredFlag, parseAssetFileOwner } from './parsing.js';
import { appendStudioResourceChangedEvent } from '../studio-resource-event-command.js';

export async function importReferenceFiles(options: RunAssetFileCommandOptions): Promise<number> {
  let document: Pick<ImportReferenceFilesInput, 'destination' | 'files'>;
  if (options.flags.file) {
    if (options.flags.source || options.flags.owner || options.flags.title) {
      throw new StructuredError({ code: 'CLI_REFERENCE_IMPORT_FLAGS_INVALID', message: 'Use --file alone, or --source with --owner and optional --title.' });
    }
    try { document = JSON.parse(await fs.readFile(options.flags.file, 'utf8')); }
    catch { throw new StructuredError({ code: 'CLI_REFERENCE_IMPORT_DOCUMENT_INVALID', message: 'The reference import file must contain readable JSON.' }); }
  } else {
    const owner = parseAssetFileOwner(requiredFlag(options, 'owner'));
    if (owner.kind !== 'project' && owner.kind !== 'inspirationFolder') {
      throw new StructuredError({ code: 'CLI_REFERENCE_IMPORT_OWNER_INVALID', message: 'Reference import owner must be project or inspirationFolder:<id>.' });
    }
    document = { destination: owner.kind === 'project' ? { kind: 'research' } : { kind: 'inspiration', folderId: owner.id },
      files: [{ sourceProjectRelativePath: requiredFlag(options, 'source'), ...(options.flags.title === undefined ? {} : { title: options.flags.title }) }] };
  }
  const projectDataService = createProjectDataService();
  const report = await projectDataService.importReferenceFiles({ ...document,
    projectName: requiredFlag(options, 'project'), homeDir: options.homeDir });
  await appendStudioResourceChangedEvent({ runtime: { homeDir: options.homeDir, json: options.json, io: options.io, projectDataService },
    report, command: 'asset import' });
  if (options.json) { options.io.stdout.log(JSON.stringify(report, null, 2)); }
  else {
    for (const file of report.assetFiles) {
      options.io.stdout.log(`Imported reference: ${file.id} ${file.projectRelativePath}`);
    }
  }
  return 0;
}
