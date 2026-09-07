import type { DatabaseSession } from '../../../database/lifecycle/store.js';
import type { ProjectAssetFileWriteSet } from '../../../project-asset-files/types.js';
import { insertScreenplayRevision } from '../../persistence/revisions.js';
import { replaceScreenplayAggregate } from '../../persistence/screenplay.js';
import type { ScreenplayImport } from '../contracts.js';
import type { MappedFdxScreenplay } from '../mapping/screenplay.js';
import type { FdxSource } from '../source.js';
import { updateScreenplayImport } from './import-record.js';
import { persistFdxSourceAsset } from './source-asset.js';

export function persistSourceOnlyRefresh(input: {
  session: DatabaseSession;
  projectFolder: string;
  writeSet: ProjectAssetFileWriteSet;
  source: FdxSource;
  screenplayImport: ScreenplayImport;
}): void {
  persistFdxSourceAsset({
    session: input.session,
    projectFolder: input.projectFolder,
    source: input.source,
    assetId: input.screenplayImport.sourceAssetId,
    assetFileId: input.screenplayImport.sourceAssetFileId,
    now: input.screenplayImport.importedAt,
    writeSet: input.writeSet,
  });
  updateScreenplayImport(input.session, input.screenplayImport);
}

export function persistSemanticRefresh(input: {
  session: DatabaseSession;
  projectFolder: string;
  writeSet: ProjectAssetFileWriteSet;
  source: FdxSource;
  screenplayImport: ScreenplayImport;
  screenplay: MappedFdxScreenplay['screenplay'];
  revisionId: string;
  now: string;
}): void {
  persistFdxSourceAsset({
    session: input.session,
    projectFolder: input.projectFolder,
    source: input.source,
    assetId: input.screenplayImport.sourceAssetId,
    assetFileId: input.screenplayImport.sourceAssetFileId,
    now: input.now,
    writeSet: input.writeSet,
  });
  replaceScreenplayAggregate(input.session, input.screenplay);
  updateScreenplayImport(input.session, input.screenplayImport);
  insertScreenplayRevision({
    session: input.session,
    id: input.revisionId,
    screenplay: input.screenplay,
    sourceCommand: 'screenplay.import-fdx',
    createdAt: input.now,
  });
}

