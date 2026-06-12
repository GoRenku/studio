import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  Asset,
  CastGenerationAssetFileReference,
  CastGenerationLookbookContext,
  CastGenerationProjectContext,
  CastGenerationScreenplayContext,
  CastGenerationTimePeriodContext,
  CastImageDetail,
  CastImageFrame,
  CastImageOutputFormat,
  CastMediaGenerationTarget,
  CastMediaImportReport,
  MediaGenerationSpec,
  PreparedMediaGeneration,
} from '../../client/index.js';
import { insertAssetFileRecord } from '../database/access/asset-files.js';
import { insertAssetRecord } from '../database/access/assets.js';
import {
  insertAssetRelationshipRecord,
  listAssetRelationshipPage,
  nextAssetRelationshipSortOrder,
  readAssetRelationship,
} from '../database/access/asset-relationships/index.js';
import { readCastMemberRecord } from '../database/access/cast-members.js';
import {
  listLookbookCardImageIds,
  readActiveLookbookId,
  requireLookbookRecordById,
  toLookbook,
} from '../database/access/lookbook.js';
import { listLookbookImages, readLookbookImage } from '../database/access/lookbook-images.js';
import { readProjectInformationResourceFromDatabase } from '../database/access/project-information.js';
import { readProjectRecord, type ProjectRecord } from '../database/access/project.js';
import { readScreenplayDocumentFromSession } from '../database/access/screenplay-resource.js';
import { openProjectSession } from '../database/lifecycle/active-session.js';
import { withCurrentProjectSession } from '../database/lifecycle/current-project.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import {
  createRandomIdGenerator,
  createUniqueIdAllocator,
  type ProjectIdGenerator,
} from '../entity-ids.js';
import { CAST_ROOT } from '../files/asset-paths.js';
import {
  joinProjectRelativePath,
  normalizeProjectRelativePath,
  resolveProjectRelativePath,
} from '../files/project-relative-paths.js';
import { ProjectDataError } from '../project-data-error.js';
import type { RenkuConfigPathOptions } from '../renku-config.js';
import { studioResourceKeysForAssetTarget } from '../studio-coordination/resource-keys.js';

export const CAST_IMAGE_FRAMES = new Set(['1:1', '3:4', '4:3', '16:9', '9:16', '21:9']);
export const CAST_IMAGE_OUTPUT_FORMATS = new Set(['png', 'jpeg', 'webp']);

export interface CastImageProjectInput extends RenkuConfigPathOptions {
  projectName?: string;
}

export interface CastImageTargetInput extends CastImageProjectInput {
  castMemberId: string;
}

export interface CastProviderPlan {
  provider: 'fal-ai';
  model: string;
  mode: 'text-to-image' | 'image-edit';
  payload: Record<string, unknown>;
  outputCount: number;
  inputFiles?: PreparedMediaGeneration['generation']['request']['inputFiles'];
}

export interface ImportCastImageMediaInput extends CastImageTargetInput {
  purpose: CastMediaImportReport['purpose'];
  sourceProjectRelativePath: string;
  title?: string;
  oneLineSummary?: string;
  referenceName?: string;
  referencePurpose?: string;
  receipt?: unknown;
  idGenerator?: ProjectIdGenerator;
}

export interface CastImportPurposeConfig {
  assetType: string;
  assetRole: string;
  folderName: string;
  changeType: string;
}

export async function withCastProjectSession<T>(
  input: CastImageProjectInput,
  fn: (handle: {
    projectFolder: string;
    project: Pick<ProjectRecord, 'id' | 'name'>;
    session: DatabaseSession;
  }) => T | Promise<T>
): Promise<T> {
  if (input.projectName) {
    const handle = await openProjectSession({
      projectName: input.projectName,
      homeDir: input.homeDir,
    });
    try {
      return await fn({ ...handle, project: requireProjectRecord(handle.session) });
    } finally {
      handle.session.close();
    }
  }
  return withCurrentProjectSession(input, ({ currentProject, session }) =>
    fn({
      projectFolder: currentProject.projectFolder,
      project: { id: currentProject.projectId, name: currentProject.projectName },
      session,
    })
  );
}

export async function readCastProjectContext(
  input: CastImageProjectInput
): Promise<CastGenerationProjectContext> {
  return withCastProjectSession(input, ({ session, project }) => {
    const info = readProjectInformationResourceFromDatabase(session);
    return {
      id: project.id,
      name: project.name,
      title: info.title,
      aspectRatio: info.aspectRatio ?? '16:9',
      logline: info.logline ?? null,
      summary: info.summary ?? null,
      languages: info.languages,
    };
  });
}

export function buildScreenplayContext(
  session: DatabaseSession
): CastGenerationScreenplayContext | null {
  const document = readScreenplayDocumentFromSession(session);
  if (!document) {
    return null;
  }
  const screenplay = document.screenplay;
  return {
    title: screenplay.title,
    genrePrimary: screenplay.genrePrimary,
    genreSecondary: screenplay.genreSecondary,
    tone: screenplay.tone,
    logline: screenplay.logline,
    summary: screenplay.summary,
    premiseOverview: screenplay.premiseOverview,
    centralConflict: screenplay.centralConflict,
    dramaticQuestion: screenplay.dramaticQuestion,
    themes: screenplay.themes,
    historicalBasis: screenplay.historicalBasis,
  };
}

export function buildTimePeriodContext(
  session: DatabaseSession,
  castMemberId: string
): CastGenerationTimePeriodContext {
  const document = readScreenplayDocumentFromSession(session);
  if (!document) {
    return { historicalBasis: [], locationTimePeriods: [], sceneSignals: [] };
  }
  const referencedLocationIds = new Set<string>();
  const sceneSignals: CastGenerationTimePeriodContext['sceneSignals'] = [];
  for (const act of document.acts) {
    for (const sequence of act.sequences) {
      for (const scene of sequence.scenes) {
        if (!scene.id || !sceneReferencesCast(scene, castMemberId)) {
          continue;
        }
        for (const locationId of scene.setting.locationIds ?? []) {
          referencedLocationIds.add(locationId);
        }
        sceneSignals.push({
          sceneId: scene.id,
          title: scene.title,
          setting: scene.setting,
        });
      }
    }
  }
  const locationTimePeriods = document.locations
    .filter((location) => location.id && referencedLocationIds.has(location.id))
    .map((location) => location.timePeriod)
    .filter((value): value is string => Boolean(value));
  return {
    historicalBasis: document.screenplay.historicalBasis ?? [],
    locationTimePeriods: Array.from(new Set(locationTimePeriods)),
    sceneSignals,
  };
}

function sceneReferencesCast(
  scene: NonNullable<ReturnType<typeof readScreenplayDocumentFromSession>>['acts'][number]['sequences'][number]['scenes'][number],
  castMemberId: string
): boolean {
  for (const block of scene.blocks) {
    if ('castMemberId' in block && block.castMemberId === castMemberId) {
      return true;
    }
    if (block.castMemberIds?.includes(castMemberId)) {
      return true;
    }
  }
  return false;
}

export function requireCastMemberForContext(
  session: DatabaseSession,
  castMemberId: string
) {
  const row = readCastMemberRecord(session, castMemberId);
  if (!row) {
    throw new ProjectDataError(
      'PROJECT_DATA115',
      `Cast member was not found: ${castMemberId}.`
    );
  }
  return {
    id: row.id,
    handle: row.handle,
    name: row.name,
    isVoiceOver: row.isVoiceOver,
    role: row.role ?? undefined,
    age: row.age ?? undefined,
    want: row.want ?? undefined,
    need: row.need ?? undefined,
    arc: row.arc ?? undefined,
    voiceNotes: row.voiceNotes ?? undefined,
    description: row.description ?? undefined,
  };
}

export function readActiveLookbookContext(
  session: DatabaseSession
): CastGenerationLookbookContext | null {
  const activeLookbookId = readActiveLookbookId(session);
  if (!activeLookbookId) {
    return null;
  }
  const row = requireLookbookRecordById(session, activeLookbookId);
  const cardImageId = listLookbookCardImageIds(session).get(row.id);
  return {
    lookbook: toLookbook(row),
    cardImage: cardImageId
      ? readLookbookImage(session, cardImageId)
      : listLookbookImages(session, row.id)[0] ?? null,
    isActive: true,
  };
}

export function requireActiveLookbookContext(
  session: DatabaseSession
): CastGenerationLookbookContext {
  const activeLookbook = readActiveLookbookContext(session);
  if (!activeLookbook) {
    throw new ProjectDataError(
      'PROJECT_DATA275',
      'Cast character sheet generation requires an active Lookbook.',
      {
        suggestion:
          'Create or set an active Lookbook before generating a character sheet.',
      }
    );
  }
  return activeLookbook;
}

export function readCastAssetsByRole(
  session: DatabaseSession,
  castMemberId: string
): {
  selectedAssets: Asset[];
  selectedCharacterSheets: Asset[];
  characterSheetTakes: Asset[];
  profileTakes: Asset[];
} {
  const target = { kind: 'castMember' as const, castMemberId };
  const selectedAssets = listAssetRelationshipPage(session, {
    target,
    selection: 'select',
    limit: 200,
  }).items;
  return {
    selectedAssets,
    selectedCharacterSheets: selectedAssets.filter(
      (asset) => asset.role === 'character_sheet' && asset.mediaKind === 'image'
    ),
    characterSheetTakes: listAssetRelationshipPage(session, {
      target,
      role: 'character_sheet',
      selection: 'take',
      limit: 200,
    }).items,
    profileTakes: listAssetRelationshipPage(session, {
      target,
      role: 'profile',
      selection: 'take',
      limit: 200,
    }).items,
  };
}

export function imageFileReferences(
  projectFolder: string,
  assets: Asset[]
): CastGenerationAssetFileReference[] {
  const references: CastGenerationAssetFileReference[] = [];
  for (const asset of assets) {
    for (const file of asset.files) {
      if (file.mediaKind !== 'image') {
        continue;
      }
      references.push({
        assetId: asset.assetId,
        assetFileId: file.id,
        role: file.role,
        projectRelativePath: file.projectRelativePath,
        absolutePath: resolveProjectRelativePath(
          projectFolder,
          file.projectRelativePath
        ),
        mediaKind: file.mediaKind,
        mimeType: file.mimeType,
      });
    }
  }
  return references;
}

export function normalizeCastImageSpecControls<T extends {
  prompt: string;
  takeCount?: number;
  seed?: number | null;
  imageFrame?: CastImageFrame;
  detail?: CastImageDetail;
  outputFormat?: CastImageOutputFormat;
}>(spec: T, defaultFrame: CastImageFrame): T & {
  takeCount: number;
  seed: number | null;
  imageFrame: CastImageFrame;
  detail: CastImageDetail;
  outputFormat: CastImageOutputFormat;
} {
  if (spec.prompt.trim().length === 0) {
    throw new ProjectDataError('PROJECT_DATA276', 'Cast image prompt cannot be empty.');
  }
  const takeCount = spec.takeCount ?? 1;
  if (!Number.isInteger(takeCount) || takeCount < 1) {
    throw new ProjectDataError(
      'PROJECT_DATA277',
      'Cast image takeCount must be a positive integer.'
    );
  }
  const seed = spec.seed ?? null;
  if (seed !== null && (!Number.isInteger(seed) || seed < 0)) {
    throw new ProjectDataError(
      'PROJECT_DATA278',
      'Cast image seed must be a non-negative integer or null.'
    );
  }
  const imageFrame = spec.imageFrame ?? defaultFrame;
  if (imageFrame !== 'project' && !CAST_IMAGE_FRAMES.has(imageFrame)) {
    throw new ProjectDataError(
      'PROJECT_DATA279',
      `Unsupported Cast image frame: ${imageFrame}.`
    );
  }
  const detail = spec.detail ?? 'standard';
  if (detail !== 'draft' && detail !== 'standard' && detail !== 'high') {
    throw new ProjectDataError(
      'PROJECT_DATA280',
      `Unsupported Cast image detail: ${detail}.`
    );
  }
  const outputFormat = spec.outputFormat ?? 'png';
  if (!CAST_IMAGE_OUTPUT_FORMATS.has(outputFormat)) {
    throw new ProjectDataError(
      'PROJECT_DATA281',
      `Unsupported Cast image output format: ${outputFormat}.`
    );
  }
  return {
    ...spec,
    prompt: spec.prompt.trim(),
    takeCount,
    seed,
    imageFrame,
    detail,
    outputFormat,
  };
}

export function resolveCastImageFrame(
  spec: { imageFrame?: CastImageFrame },
  projectAspectRatio: string | null
): Exclude<CastImageFrame, 'project'> {
  const frame = spec.imageFrame ?? 'project';
  if (frame !== 'project') {
    return frame;
  }
  if (!projectAspectRatio || !CAST_IMAGE_FRAMES.has(projectAspectRatio)) {
    throw new ProjectDataError(
      'PROJECT_DATA282',
      'Cast image frame is set to project, but the project has no supported aspect ratio.'
    );
  }
  return projectAspectRatio as Exclude<CastImageFrame, 'project'>;
}

export function mapPresetFrame(frame: Exclude<CastImageFrame, 'project'>): string {
  if (frame === '1:1') {
    return 'square';
  }
  if (frame === '3:4') {
    return 'portrait_4_3';
  }
  if (frame === '4:3') {
    return 'landscape_4_3';
  }
  if (frame === '16:9') {
    return 'landscape_16_9';
  }
  if (frame === '9:16') {
    return 'portrait_16_9';
  }
  throw new ProjectDataError(
    'PROJECT_DATA272',
    'Selected model does not support 21:9 in this slice.'
  );
}

export function mapGptQuality(detail: CastImageDetail): 'low' | 'medium' | 'high' {
  if (detail === 'draft') {
    return 'low';
  }
  if (detail === 'standard') {
    return 'medium';
  }
  return 'high';
}

export function mapNanoBananaResolution(detail: CastImageDetail): '1K' | '2K' | '4K' {
  if (detail === 'draft') {
    return '1K';
  }
  if (detail === 'standard') {
    return '2K';
  }
  return '4K';
}

export function requireTakeCount(spec: { takeCount?: number }, max: number): number {
  const takeCount = spec.takeCount ?? 1;
  if (takeCount > max) {
    throw new ProjectDataError(
      'PROJECT_DATA272',
      `Selected model supports at most ${max} takes per run.`
    );
  }
  return takeCount;
}

export function outputNames(
  spec: MediaGenerationSpec & { outputFormat?: string },
  count: number,
  fallback: string
): string[] {
  const base = slugify(titleForSpec(spec, fallback));
  const outputFormat =
    spec.outputFormat === 'jpeg' || spec.outputFormat === 'webp'
      ? spec.outputFormat
      : 'png';
  const extension = extensionForOutputFormat(outputFormat);
  return Array.from({ length: count }, (_, index) =>
    count === 1
      ? `${base}${extension}`
      : `${base}-${String(index + 1).padStart(2, '0')}${extension}`
  );
}

export function titleForSpec(spec: MediaGenerationSpec, fallback: string): string {
  const prompt = 'prompt' in spec ? spec.prompt : '';
  return spec.title?.trim() || prompt.trim().slice(0, 80) || fallback;
}

export function toGenerationRequest(
  plan: CastProviderPlan,
  spec: MediaGenerationSpec,
  fallbackTitle: string
): PreparedMediaGeneration['generation'] {
  const { prompt, ...parameters } = plan.payload;
  return {
    policy: {
      provider: plan.provider,
      model: plan.model,
      mediaKind: 'image',
      mode: plan.mode,
      outputCount: plan.outputCount,
    },
    request: {
      prompt:
        typeof prompt === 'string'
          ? prompt
          : 'prompt' in spec
            ? spec.prompt
            : fallbackTitle,
      ...(plan.inputFiles ? { inputFiles: plan.inputFiles } : {}),
      parameters,
      outputNames: outputNames(spec, plan.outputCount, fallbackTitle),
    },
  };
}

export async function resolveCastGenerationOutputPaths(input: CastImageProjectInput) {
  return withCastProjectSession(input, ({ projectFolder }) => {
    const projectRelativeRoot = 'generated/media';
    return {
      absoluteRoot: path.join(projectFolder, projectRelativeRoot),
      projectRelativeRoot,
      projectFolder,
    };
  });
}

export async function importCastImageMedia(
  input: ImportCastImageMediaInput,
  config: CastImportPurposeConfig
): Promise<CastMediaImportReport> {
  return withCastProjectSession(input, async ({ session, projectFolder, project }) => {
    const castMember = requireCastMemberForContext(session, input.castMemberId);
    const now = new Date().toISOString();
    const imported = await importCastImageFile({
      session,
      projectFolder,
      castMemberHandle: castMember.handle,
      config,
      sourceProjectRelativePath: input.sourceProjectRelativePath,
      title: input.title,
      oneLineSummary: input.oneLineSummary,
      idGenerator: input.idGenerator,
      now,
      origin: input.receipt ? 'generated' : 'imported',
    });
    const target = { kind: 'castMember' as const, castMemberId: input.castMemberId };
    const relationshipId = imported.nextId('cast_asset');
    insertAssetRelationshipRecord(session, target, {
      relationshipId,
      assetId: imported.assetId,
      localeId: null,
      role: config.assetRole,
      referenceName: input.referenceName?.trim() || null,
      purpose: input.referencePurpose?.trim() || null,
      sortOrder: nextAssetRelationshipSortOrder(session, {
        target,
        role: config.assetRole,
        localeId: null,
      }),
      now,
    });
    const asset = readAssetRelationship(session, {
      target,
      assetId: imported.assetId,
    });
    if (!asset) {
      throw new ProjectDataError(
        'PROJECT_DATA078',
        `Asset ${imported.assetId} is not attached to the requested cast member.`
      );
    }
    const resourceKeys = studioResourceKeysForAssetTarget(target);
    return {
      valid: true,
      warnings: [],
      project: {
        id: project.id,
        name: project.name,
        projectFolder,
      },
      changes: [{ type: config.changeType, castMemberId: input.castMemberId }],
      purpose: input.purpose,
      target: { kind: 'castMember', id: input.castMemberId },
      imported: asset,
      ...(input.receipt ? { receipt: input.receipt } : {}),
      resourceKeys,
    };
  });
}

export function validateCastTarget(target: CastMediaGenerationTarget): void {
  if (target.kind !== 'castMember') {
    throw new ProjectDataError(
      'PROJECT_DATA283',
      `Cast image generation requires target.kind "castMember". Received: ${target.kind}.`
    );
  }
}

export function readSourceCharacterSheetAsset(
  session: DatabaseSession,
  input: { castMemberId: string; sourceAssetId: string }
): { asset: Asset; projectRelativePath: string } {
  const asset = readAssetRelationship(session, {
    target: { kind: 'castMember', castMemberId: input.castMemberId },
    assetId: input.sourceAssetId,
  });
  if (!asset) {
    throw new ProjectDataError(
      'PROJECT_DATA284',
      `Profile source asset is not attached to cast member ${input.castMemberId}: ${input.sourceAssetId}.`
    );
  }
  if (asset.role !== 'character_sheet') {
    throw new ProjectDataError(
      'PROJECT_DATA285',
      `Profile source asset must use cast asset role "character_sheet". Received: ${asset.role}.`
    );
  }
  if (asset.mediaKind !== 'image') {
    throw new ProjectDataError(
      'PROJECT_DATA286',
      `Profile source asset must be an image. Received: ${asset.mediaKind}.`
    );
  }
  const file = asset.files.find((candidate) => candidate.mediaKind === 'image');
  if (!file) {
    throw new ProjectDataError(
      'PROJECT_DATA287',
      `Profile source asset has no image file: ${input.sourceAssetId}.`
    );
  }
  return {
    asset,
    projectRelativePath: file.projectRelativePath,
  };
}

function slugify(input: string): string {
  const slug = input
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return slug || 'cast-image';
}

function extensionForOutputFormat(format: CastImageOutputFormat): string {
  return format === 'jpeg' ? '.jpg' : `.${format}`;
}

function requireProjectRecord(session: DatabaseSession): ProjectRecord {
  const project = readProjectRecord(session);
  if (!project) {
    throw new ProjectDataError(
      'PROJECT_DATA021',
      `Project database has no project row: ${session.databasePath}.`
    );
  }
  return project;
}

async function importCastImageFile(input: {
  session: DatabaseSession;
  projectFolder: string;
  castMemberHandle: string;
  config: CastImportPurposeConfig;
  sourceProjectRelativePath: string;
  title?: string;
  oneLineSummary?: string;
  origin: string;
  idGenerator?: ProjectIdGenerator;
  now: string;
}) {
  const sourceProjectRelativePath = normalizeProjectRelativePath(
    input.sourceProjectRelativePath
  );
  const sourcePath = resolveProjectRelativePath(
    input.projectFolder,
    sourceProjectRelativePath
  );
  assertResolvedPathInsideProject(input.projectFolder, sourcePath);
  const stats = await statExistingFile(sourcePath);
  const contentHash = await hashFile(sourcePath);
  const destinationProjectRelativePath = await allocateCastImageFilePath({
    projectFolder: input.projectFolder,
    castMemberHandle: input.castMemberHandle,
    folderName: input.config.folderName,
    fileName: path.basename(sourceProjectRelativePath),
  });
  const destinationPath = resolveProjectRelativePath(
    input.projectFolder,
    destinationProjectRelativePath
  );
  assertResolvedPathInsideProject(input.projectFolder, destinationPath);
  await fs.mkdir(path.dirname(destinationPath), { recursive: true });
  if (sourcePath !== destinationPath) {
    await fs.copyFile(sourcePath, destinationPath);
  }

  const ids = createUniqueIdAllocator(input.idGenerator ?? createRandomIdGenerator());
  const assetId = ids('asset');
  insertAssetRecord(input.session, {
    id: assetId,
    type: input.config.assetType,
    mediaKind: 'image',
    title:
      input.title?.trim() ||
      path.parse(destinationProjectRelativePath).name,
    oneLineSummary: input.oneLineSummary?.trim() || undefined,
    origin: input.origin,
    availability: 'ready',
    createdAt: input.now,
    updatedAt: input.now,
  });
  insertAssetFileRecord(input.session, {
    id: ids('asset_file'),
    assetId,
    role: 'primary',
    projectRelativePath: destinationProjectRelativePath,
    mediaKind: 'image',
    sizeBytes: stats.size,
    contentHash,
    createdAt: input.now,
    updatedAt: input.now,
  });
  return {
    assetId,
    nextId: ids,
  };
}

async function allocateCastImageFilePath(input: {
  projectFolder: string;
  castMemberHandle: string;
  folderName: string;
  fileName: string;
}) {
  const parent = joinProjectRelativePath(
    CAST_ROOT,
    input.castMemberHandle,
    input.folderName
  );
  const parsed = path.parse(input.fileName);
  const base = parsed.name || 'image';
  const extension = parsed.ext || '.png';
  for (let index = 0; index < 1000; index += 1) {
    const candidate = joinProjectRelativePath(
      parent,
      index === 0 ? `${base}${extension}` : `${base}-${index + 1}${extension}`
    );
    try {
      await fs.access(resolveProjectRelativePath(input.projectFolder, candidate));
    } catch {
      return candidate;
    }
  }
  throw new ProjectDataError(
    'PROJECT_DATA288',
    `Could not allocate a unique cast image path for ${input.fileName}.`
  );
}

function assertResolvedPathInsideProject(
  projectFolder: string,
  absolutePath: string
): void {
  const relative = path.relative(projectFolder, absolutePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new ProjectDataError(
      'PROJECT_DATA245',
      `Media import source file must be inside the project folder: ${absolutePath}.`
    );
  }
}

async function statExistingFile(absolutePath: string): Promise<{ size: number }> {
  try {
    const stats = await fs.stat(absolutePath);
    if (!stats.isFile()) {
      throw new Error('not a regular file');
    }
    return { size: stats.size };
  } catch {
    throw new ProjectDataError(
      'PROJECT_DATA245',
      `Media import source file does not exist: ${absolutePath}.`
    );
  }
}

async function hashFile(absolutePath: string): Promise<string> {
  const buffer = await fs.readFile(absolutePath);
  return `sha256:${crypto.createHash('sha256').update(buffer).digest('hex')}`;
}
