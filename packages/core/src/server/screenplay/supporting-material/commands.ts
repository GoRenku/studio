import { readProjectRecord } from '../../database/access/project.js';
import { openProjectSession } from '../../database/lifecycle/active-session.js';
import { createRandomIdGenerator, type ProjectIdGenerator } from '../../entity-ids.js';
import { ProjectDataError } from '../../project-data-error.js';
import { studioProjectAssetsResourceKey } from '../../studio-coordination/resource-keys.js';
import {
  commitProjectAssetFileWriteSet,
  createProjectAssetFileWriteSet,
  rollbackProjectAssetFileWriteSetSync,
} from '../../project-asset-files/index.js';
import type {
  ImportScreenplaySupportingMaterialInput,
  ImportScreenplaySupportingMaterialReport,
} from './contracts.js';
import {
  destinationConflict,
  destinationWriteFailure,
  findExistingScreenplaySupportingMaterial,
  isProjectAssetDestinationConflict,
  isProjectAssetDestinationWriteFailure,
  isProjectAssetSourceReadFailure,
  persistScreenplaySupportingMaterial,
} from './persistence.js';
import {
  readScreenplaySupportingMaterialSource,
  supportingMaterialInvalidSource,
} from './source.js';

export async function importScreenplaySupportingMaterial(
  input: ImportScreenplaySupportingMaterialInput,
  dependencies: {
    idGenerator?: ProjectIdGenerator;
    now?: () => string;
  } = {},
): Promise<ImportScreenplaySupportingMaterialReport> {
  const source = await readScreenplaySupportingMaterialSource(input.sourcePath);
  const { projectFolder, session } = await openProjectSession(input);
  const writeSet = createProjectAssetFileWriteSet({ projectFolder });
  try {
    const project = readProjectRecord(session);
    if (!project) {
      throw new ProjectDataError(
        'PROJECT_DATA021',
        `Project database has no project row: ${session.databasePath}.`,
      );
    }
    const existing = findExistingScreenplaySupportingMaterial({
      session,
      projectFolder,
      sha256: source.sha256,
    });
    if (existing) {
      return report({
        status: 'unchanged',
        project,
        projectFolder,
        material: existing,
      });
    }

    const ids = dependencies.idGenerator ?? createRandomIdGenerator();
    const now = (dependencies.now ?? (() => new Date().toISOString()))();
    let material: ImportScreenplaySupportingMaterialReport['material'] | undefined;
    session.db.transaction((tx) => {
      material = persistScreenplaySupportingMaterial({
        session: { ...session, db: tx },
        projectFolder,
        source,
        assetId: ids.next('asset'),
        assetFileId: ids.next('asset_file'),
        now,
        writeSet,
      });
    });
    if (!material) {
      throw destinationConflict('Imported supporting material was not returned after persistence.');
    }
    commitProjectAssetFileWriteSet(writeSet);
    return report({
      status: 'imported',
      project,
      projectFolder,
      material,
    });
  } catch (error) {
    rollbackProjectAssetFileWriteSetSync(writeSet);
    if (isProjectAssetDestinationConflict(error)) {
      throw destinationConflict('Could not allocate a supporting-material destination under screenplay/.');
    }
    if (isProjectAssetSourceReadFailure(error)) {
      throw supportingMaterialInvalidSource(
        `Supporting material became unreadable during import: ${source.absolutePath}.`,
      );
    }
    if (isProjectAssetDestinationWriteFailure(error)) {
      throw destinationWriteFailure();
    }
    throw error;
  } finally {
    session.close();
  }
}

function report(input: {
  status: ImportScreenplaySupportingMaterialReport['status'];
  project: { id: string; projectName: string };
  projectFolder: string;
  material: ImportScreenplaySupportingMaterialReport['material'];
}): ImportScreenplaySupportingMaterialReport {
  return {
    valid: true,
    warnings: [],
    status: input.status,
    project: {
      id: input.project.id,
      projectName: input.project.projectName,
      projectFolder: input.projectFolder,
    },
    material: input.material,
    resourceKeys: input.status === 'imported' ? [studioProjectAssetsResourceKey()] : [],
  };
}
