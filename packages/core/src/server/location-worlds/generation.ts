import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import path from 'node:path';
import { Readable } from 'node:stream';
import { pipeline } from 'node:stream/promises';
import {
  generateWorldLabsLocationWorld,
  loadProviderEnvFiles,
  type GenerateWorldLabsLocationWorldInput,
  type WorldLabsLocationWorldResult,
} from '@gorenku/studio-engines';
import type {
  LocationWorldGenerationReport,
  LocationWorldGenerationDocument,
} from '../../client/index.js';
import { createRandomIdGenerator, type ProjectIdGenerator } from '../entity-ids.js';
import { withGenerationProject } from '../generation/project-operation.js';
import { readProjectRecord } from '../database/access/project.js';
import { insertAssetRecord } from '../database/access/assets.js';
import { createAssetMembership } from '../assets/ownership.js';
import { readOwnedAsset } from '../assets/projection.js';
import { selectAssetInSession } from '../assets/selection.js';
import { assetOwnerResourceKeys } from '../assets/resource-keys.js';
import {
  commitProjectAssetFileWriteSet,
  createProjectAssetFileWriteSet,
  persistProjectAssetFileSync,
  resolveTemporaryFileRoot,
  rollbackProjectAssetFileWriteSet,
} from '../project-asset-files/index.js';
import { joinProjectRelativePath, resolveProjectRelativePath } from '../files/project-relative-paths.js';
import { ProjectDataError } from '../project-data-error.js';
import type { RenkuConfigPathOptions } from '../renku-config.js';
import { locationWorldTitle } from './assets.js';
import { validateLocationWorldInput } from './input.js';

type WorldLabsGenerator = (
  input: GenerateWorldLabsLocationWorldInput
) => Promise<WorldLabsLocationWorldResult>;

export async function generateLocationWorld(
  input: RenkuConfigPathOptions & {
    projectName?: string;
    document: LocationWorldGenerationDocument;
  },
  dependencies: {
    generate?: WorldLabsGenerator;
    idGenerator?: ProjectIdGenerator;
    now?: () => string;
  } = {}
): Promise<LocationWorldGenerationReport> {
  return withGenerationProject(input, async ({ session, projectFolder }) => {
    const validated = await validateLocationWorldInput({
      document: input.document,
      session,
      projectFolder,
    });
    const readImage = async (image: {
      fileName: string;
      extension: 'jpg' | 'jpeg' | 'png' | 'webp';
      mimeType: string;
      absolutePath: string;
    }) => ({
      fileName: image.fileName,
      extension: image.extension,
      mimeType: image.mimeType,
      bytes: await fs.readFile(image.absolutePath),
    });
    const source: GenerateWorldLabsLocationWorldInput['source'] =
      validated.source.kind === 'panorama'
        ? {
            kind: 'panorama',
            image: await readImage(validated.source.image),
          }
        : {
            kind: 'multiImage',
            images: await Promise.all(validated.source.images.map(readImage)),
          };
    loadProviderEnvFiles({ homeDir: input.homeDir });
    let generated: WorldLabsLocationWorldResult;
    try {
      generated = await (dependencies.generate ?? generateWorldLabsLocationWorld)({
        displayName: locationWorldTitle(validated.location).slice(0, 64),
        ...(validated.document.prompt === undefined
          ? {}
          : { prompt: validated.document.prompt }),
        source,
        secretResolver: {
          async getSecret(key) {
            return process.env[key] ?? null;
          },
        },
      });
    } catch (error) {
      throw new ProjectDataError(
        'LOCATION_WORLD_GENERATION_FAILED',
        'World Labs could not generate the Location World.',
        {
          suggestion: error instanceof Error
            ? error.message
            : 'Check World Labs configuration and try again.',
        }
      );
    }

    const idGenerator = dependencies.idGenerator ?? createRandomIdGenerator();
    const staging = await createSpzStagingPath(projectFolder, idGenerator);
    try {
      await pipeline(
        Readable.fromWeb(generated.body),
        fsSync.createWriteStream(staging.absolutePath, { flags: 'wx' })
      );
      const stats = await fs.stat(staging.absolutePath);
      if (!stats.isFile() || stats.size === 0) {
        throw new ProjectDataError(
          'LOCATION_WORLD_OUTPUT_MISSING',
          'World Labs returned an empty full-resolution SPZ.'
        );
      }
      const project = readProjectRecord(session);
      if (!project) {
        throw new ProjectDataError(
          'PROJECT_DATA021',
          `Project database has no project row: ${session.databasePath}.`
        );
      }
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
            sourceProjectRelativePath: staging.projectRelativePath,
            destination: {
              kind: 'location.world',
              locationId: validated.location.id,
            },
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
          'The generated World could not be saved to the Project.'
        );
      }
      const asset = readOwnedAsset(session, { owner, assetId });
      if (!asset) {
        throw new ProjectDataError(
          'LOCATION_WORLD_PERSISTENCE_FAILED',
          'The saved Location World could not be read back.'
        );
      }
      return {
        valid: true,
        warnings: [],
        project: {
          projectName: project.projectName,
          id: project.id,
          projectFolder,
        },
        location: validated.location,
        asset,
        selectedAssetId: asset.id,
        provider: {
          name: 'world-labs',
          model: 'marble-1.1',
          operationId: generated.operationId,
          worldId: generated.worldId,
        },
        resourceKeys: assetOwnerResourceKeys(session, owner),
      };
    } finally {
      await fs.rm(staging.absolutePath, { force: true });
    }
  });
}

async function createSpzStagingPath(
  projectFolder: string,
  idGenerator: ProjectIdGenerator
): Promise<{ projectRelativePath: import('../../client/index.js').ProjectRelativePath; absolutePath: string }> {
  const root = await resolveTemporaryFileRoot({
    projectFolder,
    destination: { kind: 'location.world' },
  });
  const projectRelativePath = joinProjectRelativePath(
    root,
    `${idGenerator.next('asset_file')}.spz`
  );
  const absolutePath = resolveProjectRelativePath(projectFolder, projectRelativePath);
  await fs.mkdir(path.dirname(absolutePath), { recursive: true });
  return { projectRelativePath, absolutePath };
}
