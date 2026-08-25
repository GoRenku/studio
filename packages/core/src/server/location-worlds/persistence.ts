import fs from 'node:fs/promises';
import type {
  LocationWorldGenerationDocument,
  LocationWorldGenerationReport,
} from '../../client/index.js';
import { createAssetMembership } from '../assets/ownership.js';
import { readOwnedAsset } from '../assets/projection.js';
import { selectAssetInSession } from '../assets/selection.js';
import { assetOwnerResourceKeys } from '../assets/resource-keys.js';
import type { RenkuConfigPathOptions } from '../config/index.js';
import { insertAssetRecord } from '../database/access/assets.js';
import { readProjectRecord } from '../database/access/project.js';
import { createRandomIdGenerator, type ProjectIdGenerator } from '../entity-ids.js';
import { normalizeProjectRelativePath, resolveProjectRelativePath } from '../files/project-relative-paths.js';
import { withProject } from '../project-operation.js';
import {
  commitProjectAssetFileWriteSet,
  createProjectAssetFileWriteSet,
  persistProjectAssetFileSync,
  rollbackProjectAssetFileWriteSet,
} from '../project-asset-files/index.js';
import { ProjectDataError } from '../project-data-error.js';
import { locationWorldTitle } from './assets.js';
import { validateLocationWorldInput } from './input.js';

type ProjectInput = RenkuConfigPathOptions & { projectName?: string };

export async function prepareLocationWorldGeneration(
  input: ProjectInput & { document: LocationWorldGenerationDocument }
) {
  return withProject(input, ({ session, projectFolder }) =>
    validateLocationWorldInput({ document: input.document, session, projectFolder })
  );
}

export async function persistLocationWorldGeneration(
  input: ProjectInput & {
    document: LocationWorldGenerationDocument;
    sourceProjectRelativePath: string;
    provider: { operationId: string; worldId: string };
  },
  dependencies: { idGenerator?: ProjectIdGenerator; now?: () => string } = {},
): Promise<LocationWorldGenerationReport> {
  return withProject(input, async ({ session, projectFolder }) => {
    const validated = await validateLocationWorldInput({
      document: input.document,
      session,
      projectFolder,
    });
    const sourceProjectRelativePath = normalizeProjectRelativePath(input.sourceProjectRelativePath);
    let sourceStats;
    try {
      sourceStats = await fs.stat(resolveProjectRelativePath(projectFolder, sourceProjectRelativePath));
    } catch {
      throw new ProjectDataError(
        'LOCATION_WORLD_OUTPUT_MISSING',
        'World Labs output is not an existing Project temporary file.',
      );
    }
    if (!sourceStats.isFile() || sourceStats.size === 0) {
      throw new ProjectDataError('LOCATION_WORLD_OUTPUT_MISSING', 'World Labs returned an empty full-resolution SPZ.');
    }
    const project = readProjectRecord(session);
    if (!project) {
      throw new ProjectDataError('PROJECT_DATA021', `Project database has no project row: ${session.databasePath}.`);
    }
    const idGenerator = dependencies.idGenerator ?? createRandomIdGenerator();
    const assetId = idGenerator.next('asset');
    const assetFileId = idGenerator.next('asset_file');
    const now = dependencies.now?.() ?? new Date().toISOString();
    const owner = { kind: 'location' as const, id: validated.location.id };
    const writeSet = createProjectAssetFileWriteSet({ projectFolder });
    try {
      session.db.transaction((tx) => {
        const txSession = { ...session, db: tx };
        insertAssetRecord(txSession, {
          id: assetId,
          type: 'location_world',
          mediaKind: 'model',
          title: locationWorldTitle(validated.location),
          origin: 'world-labs',
          availability: 'ready',
          createdAt: now,
          updatedAt: now,
        });
        createAssetMembership(txSession, { assetId, owner, now });
        persistProjectAssetFileSync({
          session: txSession,
          projectFolder,
          writeSet,
          assetId,
          assetFileId,
          sourceProjectRelativePath,
          destination: { kind: 'location.world', locationId: validated.location.id },
          namingMode: { kind: 'generated' },
          fileRole: 'primary',
          mediaKind: 'model',
          mimeType: 'application/octet-stream',
          now,
        });
        selectAssetInSession(txSession, {
          target: { kind: 'locationWorld', id: validated.location.id },
          assetId,
          now,
        });
      });
      commitProjectAssetFileWriteSet(writeSet);
    } catch {
      await rollbackProjectAssetFileWriteSet(writeSet);
      throw new ProjectDataError(
        'LOCATION_WORLD_PERSISTENCE_FAILED',
        'The generated World could not be saved to the Project.',
      );
    }
    const asset = readOwnedAsset(session, { owner, assetId });
    if (!asset) {
      throw new ProjectDataError('LOCATION_WORLD_PERSISTENCE_FAILED', 'The saved Location World could not be read back.');
    }
    return {
      valid: true,
      warnings: [],
      project: { projectName: project.projectName, id: project.id, projectFolder },
      location: validated.location,
      asset,
      selectedAssetId: asset.id,
      provider: {
        name: 'world-labs',
        model: 'marble-1.1',
        operationId: input.provider.operationId,
        worldId: input.provider.worldId,
      },
      resourceKeys: assetOwnerResourceKeys(session, owner),
    };
  });
}
