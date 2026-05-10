import crypto from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type {
  ProductionExportInput,
  ProductionExportSummary,
  ProductionExportVariant,
  ProductionExportVariantSummary,
  ProjectRelativePath,
} from '../../../project/index.js';
import { ProjectDataError } from '../../../project/index.js';
import { resolveRenkuStorageRoot, type RenkuConfigPathOptions } from '../../config.js';
import { openProjectStore, type ProjectDataSession } from '../data/sqlite-project-store.js';
import { resolveProjectFolder } from '../files/project-paths.js';
import {
  joinProjectRelativePath,
  normalizeProjectRelativePath,
  resolveProjectRelativePath,
} from '../files/project-relative-paths.js';

const MANIFEST_PATH = normalizeProjectRelativePath(
  'Production Assets/Manifest/production-export-manifest.json'
);

const PRODUCTION_EXPORT_ROLES = new Set([
  'clip-video',
  'clip_video',
  'dialogue',
  'final-graphic',
  'final_graphic',
  'locale-audio-override',
  'locale_audio_override',
  'locale-video-override',
  'locale_video_override',
  'music',
  'narration',
  'sound-effect',
  'sound_effect',
  'subtitles',
  'title-card',
  'title_card',
  'video',
  'word-timing',
  'word_timing',
]);

interface SelectedAssetRow {
  assetId: string;
  relationshipId: string;
  assetFileId: string;
  targetKind: 'project' | 'visualLanguage' | 'castMember' | 'sequence' | 'scene' | 'clip';
  targetId: string | null;
  localeId: string | null;
  localeTag: string | null;
  role: string;
  selectionOrder: number;
  title: string;
  sourceProjectRelativePath: string;
  mediaKind: string;
  sourceSizeBytes: number | null;
  sourceContentHash: string | null;
}

interface DesiredExportFile {
  assetId: string;
  relationshipId: string;
  assetFileId: string;
  sourceProjectRelativePath: ProjectRelativePath;
  targetProjectRelativePath: ProjectRelativePath;
  sourceContentHash: string;
  sourceSizeBytes: number;
  sourceModifiedAt: string | null;
  role: string;
  variant: ProductionExportVariant;
  variantRootProjectRelativePath: ProjectRelativePath;
}

interface ProductionExportManifest {
  schemaVersion: 1;
  projectId: string;
  exportedAt: string;
  variants: ProductionExportVariantManifest[];
}

interface ProductionExportVariantManifest {
  variant: 'master' | 'localized';
  localeId: string | null;
  rootProjectRelativePath: string;
  treeHash: string;
  files: ProductionExportFileManifest[];
}

interface ProductionExportFileManifest {
  assetId: string;
  relationshipId: string;
  assetFileId: string;
  sourceProjectRelativePath: string;
  targetProjectRelativePath: string;
  sourceContentHash: string;
  sourceSizeBytes: number;
  sourceModifiedAt: string | null;
  role: string;
}

interface VariantPlan {
  variant: ProductionExportVariant;
  rootProjectRelativePath: ProjectRelativePath;
  treeHash: string;
  files: DesiredExportFile[];
}

interface ExportCounters {
  copied: number;
  skipped: number;
  pruned: number;
}

export async function exportProductionAssets(
  input: ProductionExportInput & RenkuConfigPathOptions
): Promise<ProductionExportSummary> {
  const storageRoot = await resolveRenkuStorageRoot(input);
  const projectFolder = resolveProjectFolder(storageRoot, input.projectName);
  const session = openProjectStore({ projectFolder, create: false });
  try {
    const project = readProjectIdentity(session);
    const variants = readRequestedVariants(session, input.variants);
    const previousManifest = input.fresh
      ? null
      : await readManifest(projectFolder, project.id);
    const selectedRows = readSelectedAssetRows(session);
    const plans = await buildVariantPlans({
      projectFolder,
      session,
      variants,
      selectedRows,
      previousManifest,
      dryRun: input.dryRun === true,
    });

    if (plans.every((plan) => plan.files.length === 0)) {
      throw new ProjectDataError(
        'PROJECT_DATA100',
        'No production-exportable selected assets were found.'
      );
    }

    const targetPaths = new Set<string>();
    for (const file of plans.flatMap((plan) => plan.files)) {
      if (targetPaths.has(file.targetProjectRelativePath)) {
        throw new ProjectDataError(
          'PROJECT_DATA101',
          `Production export target path conflict: ${file.targetProjectRelativePath}.`
        );
      }
      targetPaths.add(file.targetProjectRelativePath);
    }

    const variantSummaries: ProductionExportVariantSummary[] = [];
    const desiredTargetPaths = new Set(
      plans.flatMap((plan) =>
        plan.files.map((file) => file.targetProjectRelativePath as string)
      )
    );
    const previousFiles = new Map(
      (previousManifest?.variants ?? [])
        .flatMap((variant) => variant.files)
        .map((file) => [file.targetProjectRelativePath, file])
    );

    for (const plan of plans) {
      const previousVariant = findPreviousVariant(previousManifest, plan.variant);
      const counters = await syncVariant({
        projectFolder,
        plan,
        previousVariant,
        dryRun: input.dryRun === true,
      });
      variantSummaries.push({
        variant: plan.variant,
        rootProjectRelativePath: plan.rootProjectRelativePath,
        treeHash: plan.treeHash,
        copiedFileCount: counters.copied,
        skippedFileCount: counters.skipped,
        prunedFileCount: 0,
      });
    }

    const prunedFileCount = await prunePreviousFiles({
      projectFolder,
      previousFiles,
      desiredTargetPaths,
      dryRun: input.dryRun === true,
    });

    if (!input.dryRun) {
      await writeManifest(projectFolder, {
        schemaVersion: 1,
        projectId: project.id,
        exportedAt: new Date().toISOString(),
        variants: plans.map(toManifestVariant),
      });
    }

    const copiedFileCount = variantSummaries.reduce(
      (sum, variant) => sum + variant.copiedFileCount,
      0
    );
    const skippedFileCount = variantSummaries.reduce(
      (sum, variant) => sum + variant.skippedFileCount,
      0
    );

    return {
      copiedFileCount,
      skippedFileCount,
      prunedFileCount,
      unmanagedFileCount: 0,
      variants: variantSummaries.map((variant) => ({
        ...variant,
        prunedFileCount: 0,
      })),
    };
  } finally {
    session.close();
  }
}

function readProjectIdentity(session: ProjectDataSession): { id: string } {
  const row = session.sqlite.prepare('select id from project limit 1').get() as
    | { id: string }
    | undefined;
  if (!row) {
    throw new ProjectDataError('PROJECT_DATA102', 'Project database has no project row.');
  }
  return row;
}

function readRequestedVariants(
  session: ProjectDataSession,
  inputVariants?: ProductionExportVariant[]
): ProductionExportVariant[] {
  if (inputVariants?.length) {
    for (const variant of inputVariants) {
      if (variant.kind === 'localized') {
        assertLocaleExists(session, variant.localeId);
      }
    }
    return inputVariants;
  }

  const localeRows = session.sqlite
    .prepare(
      `select distinct r.locale_id as localeId
       from (
         select locale_id from project_asset where selection = 'select'
         union all select locale_id from sequence_asset where selection = 'select'
         union all select locale_id from scene_asset where selection = 'select'
         union all select locale_id from clip_asset where selection = 'select'
       ) r
       where r.locale_id is not null
       order by r.locale_id asc`
    )
    .all() as { localeId: string }[];

  return [
    { kind: 'master' },
    ...localeRows.map((row): ProductionExportVariant => ({
      kind: 'localized',
      localeId: row.localeId,
    })),
  ];
}

function assertLocaleExists(session: ProjectDataSession, localeId: string): void {
  const row = session.sqlite
    .prepare('select 1 from project_locale where id = ?')
    .get(localeId);
  if (!row) {
    throw new ProjectDataError(
      'PROJECT_DATA103',
      `Requested production export locale was not found: ${localeId}.`
    );
  }
}

function readSelectedAssetRows(session: ProjectDataSession): SelectedAssetRow[] {
  return session.sqlite
    .prepare(
      `
      select * from (
        select a.id as assetId, r.id as relationshipId, af.id as assetFileId,
          'project' as targetKind, null as targetId, r.locale_id as localeId,
          l.locale_tag as localeTag, r.role as role,
          coalesce(r.selection_order, 1) as selectionOrder, a.title as title,
          af.project_relative_path as sourceProjectRelativePath,
          af.media_kind as mediaKind, af.size_bytes as sourceSizeBytes,
          af.content_hash as sourceContentHash
        from project_asset r
        join asset a on a.id = r.asset_id
        join asset_file af on af.asset_id = a.id
        left join project_locale l on l.id = r.locale_id
        where r.selection = 'select' and a.availability = 'ready'

        union all

        select a.id as assetId, r.id as relationshipId, af.id as assetFileId,
          'sequence' as targetKind, r.sequence_id as targetId,
          r.locale_id as localeId, l.locale_tag as localeTag, r.role as role,
          coalesce(r.selection_order, 1) as selectionOrder, a.title as title,
          af.project_relative_path as sourceProjectRelativePath,
          af.media_kind as mediaKind, af.size_bytes as sourceSizeBytes,
          af.content_hash as sourceContentHash
        from sequence_asset r
        join asset a on a.id = r.asset_id
        join asset_file af on af.asset_id = a.id
        left join project_locale l on l.id = r.locale_id
        where r.selection = 'select' and a.availability = 'ready'

        union all

        select a.id as assetId, r.id as relationshipId, af.id as assetFileId,
          'scene' as targetKind, r.scene_id as targetId,
          r.locale_id as localeId, l.locale_tag as localeTag, r.role as role,
          coalesce(r.selection_order, 1) as selectionOrder, a.title as title,
          af.project_relative_path as sourceProjectRelativePath,
          af.media_kind as mediaKind, af.size_bytes as sourceSizeBytes,
          af.content_hash as sourceContentHash
        from scene_asset r
        join asset a on a.id = r.asset_id
        join asset_file af on af.asset_id = a.id
        left join project_locale l on l.id = r.locale_id
        where r.selection = 'select' and a.availability = 'ready'

        union all

        select a.id as assetId, r.id as relationshipId, af.id as assetFileId,
          'clip' as targetKind, r.clip_id as targetId,
          r.locale_id as localeId, l.locale_tag as localeTag, r.role as role,
          coalesce(r.selection_order, 1) as selectionOrder, a.title as title,
          af.project_relative_path as sourceProjectRelativePath,
          af.media_kind as mediaKind, af.size_bytes as sourceSizeBytes,
          af.content_hash as sourceContentHash
        from clip_asset r
        join asset a on a.id = r.asset_id
        join asset_file af on af.asset_id = a.id
        left join project_locale l on l.id = r.locale_id
        where r.selection = 'select' and a.availability = 'ready'
      )
      order by targetKind asc, targetId asc, role asc, selectionOrder asc, assetId asc
      `
    )
    .all() as SelectedAssetRow[];
}

async function buildVariantPlans(input: {
  projectFolder: string;
  session: ProjectDataSession;
  variants: ProductionExportVariant[];
  selectedRows: SelectedAssetRow[];
  previousManifest: ProductionExportManifest | null;
  dryRun: boolean;
}): Promise<VariantPlan[]> {
  const plans: VariantPlan[] = [];
  for (const variant of input.variants) {
    const rootProjectRelativePath =
      variant.kind === 'master'
        ? normalizeProjectRelativePath('Production Assets/Master')
        : joinProjectRelativePath(
            'Production Assets',
            'Localized',
            requiredLocaleTag(input.session, variant.localeId)
          );
    const files: DesiredExportFile[] = [];
    for (const row of input.selectedRows) {
      if (!isProductionExportable(row.role)) {
        continue;
      }
      if (!rowBelongsToVariant(row, variant)) {
        continue;
      }
      const sourceProjectRelativePath = normalizeProjectRelativePath(
        row.sourceProjectRelativePath
      );
      const sourcePath = resolveProjectRelativePath(
        input.projectFolder,
        sourceProjectRelativePath
      );
      const stats = await statSourceFile(sourcePath, row);
      const sourceHash = await computeSourceHash({
        sourcePath,
        sourceSizeBytes: stats.size,
        sourceModifiedAt: stats.mtime.toISOString(),
        previousFile: findPreviousFileForAssetFile(
          input.previousManifest,
          row.assetFileId
        ),
      });
      if (!input.dryRun && sourceHash.metadataNeedsRefresh) {
        refreshAssetFileMetadata({
          session: input.session,
          assetFileId: row.assetFileId,
          contentHash: sourceHash.contentHash,
          sizeBytes: stats.size,
        });
      }
      files.push({
        assetId: row.assetId,
        relationshipId: row.relationshipId,
        assetFileId: row.assetFileId,
        sourceProjectRelativePath,
        targetProjectRelativePath: allocateTargetPath(
          input.session,
          row,
          variant,
          rootProjectRelativePath
        ),
        sourceContentHash: sourceHash.contentHash,
        sourceSizeBytes: stats.size,
        sourceModifiedAt: stats.mtime.toISOString(),
        role: row.role,
        variant,
        variantRootProjectRelativePath: rootProjectRelativePath,
      });
    }
    plans.push({
      variant,
      rootProjectRelativePath,
      files,
      treeHash: buildMerkleTreeHash(rootProjectRelativePath, variant, files),
    });
  }
  return plans;
}

function rowBelongsToVariant(
  row: SelectedAssetRow,
  variant: ProductionExportVariant
): boolean {
  if (variant.kind === 'master') {
    return row.localeId === null;
  }
  return row.localeId === variant.localeId;
}

function isProductionExportable(role: string): boolean {
  return PRODUCTION_EXPORT_ROLES.has(role);
}

async function statSourceFile(
  sourcePath: string,
  row: SelectedAssetRow
): Promise<{ size: number; mtime: Date }> {
  try {
    const stats = await fs.stat(sourcePath);
    if (!stats.isFile()) {
      throw new ProjectDataError(
        'PROJECT_DATA104',
        `Selected production asset source is not a file: ${row.sourceProjectRelativePath}.`
      );
    }
    return { size: stats.size, mtime: stats.mtime };
  } catch (error) {
    if (error instanceof ProjectDataError) {
      throw error;
    }
    throw new ProjectDataError(
      'PROJECT_DATA105',
      `Selected production asset source file is missing: ${row.sourceProjectRelativePath}.`
    );
  }
}

async function computeSourceHash(input: {
  sourcePath: string;
  sourceSizeBytes: number;
  sourceModifiedAt: string;
  previousFile: ProductionExportFileManifest | null;
}): Promise<{ contentHash: string; metadataNeedsRefresh: boolean }> {
  if (
    input.previousFile?.sourceContentHash &&
    input.previousFile.sourceSizeBytes === input.sourceSizeBytes &&
    input.previousFile.sourceModifiedAt === input.sourceModifiedAt
  ) {
    return {
      contentHash: input.previousFile.sourceContentHash,
      metadataNeedsRefresh: false,
    };
  }
  return {
    contentHash: await fileContentHash(input.sourcePath),
    metadataNeedsRefresh: true,
  };
}

function refreshAssetFileMetadata(input: {
  session: ProjectDataSession;
  assetFileId: string;
  contentHash: string;
  sizeBytes: number;
}): void {
  input.session.sqlite
    .prepare(
      `update asset_file set content_hash = ?, size_bytes = ?, updated_at = ? where id = ?`
    )
    .run(input.contentHash, input.sizeBytes, new Date().toISOString(), input.assetFileId);
}

function findPreviousFileForAssetFile(
  manifest: ProductionExportManifest | null,
  assetFileId: string
): ProductionExportFileManifest | null {
  return (
    manifest?.variants
      .flatMap((variant) => variant.files)
      .find((file) => file.assetFileId === assetFileId) ?? null
  );
}

async function fileContentHash(filePath: string): Promise<string> {
  const bytes = await fs.readFile(filePath);
  return crypto.createHash('sha256').update(bytes).digest('hex');
}

function allocateTargetPath(
  session: ProjectDataSession,
  row: SelectedAssetRow,
  variant: ProductionExportVariant,
  rootProjectRelativePath: ProjectRelativePath
): ProjectRelativePath {
  if (row.targetKind === 'sequence') {
    const hierarchy = readSequenceHierarchy(session, requiredTargetId(row));
    return joinProjectRelativePath(
      rootProjectRelativePath,
      'Sequences',
      numberedSlug(hierarchy.sequencePosition, hierarchy.sequenceTitle),
      exportFileName(row)
    );
  }

  if (row.targetKind === 'scene') {
    const hierarchy = readSceneHierarchy(session, requiredTargetId(row));
    return joinProjectRelativePath(
      rootProjectRelativePath,
      'Sequences',
      numberedSlug(hierarchy.sequencePosition, hierarchy.sequenceTitle),
      'Scenes',
      numberedSlug(hierarchy.scenePosition, hierarchy.sceneTitle),
      exportFileName(row)
    );
  }

  if (row.targetKind === 'clip') {
    const hierarchy = readClipHierarchy(session, requiredTargetId(row));
    return joinProjectRelativePath(
      rootProjectRelativePath,
      'Sequences',
      numberedSlug(hierarchy.sequencePosition, hierarchy.sequenceTitle),
      'Scenes',
      numberedSlug(hierarchy.scenePosition, hierarchy.sceneTitle),
      'Clips',
      numberedSlug(hierarchy.clipPosition, hierarchy.clipTitle),
      exportFileName(row)
    );
  }

  if (row.targetKind === 'project') {
    return joinProjectRelativePath(
      rootProjectRelativePath,
      'Shared',
      sharedFolderName(row.role, variant),
      exportFileName(row)
    );
  }

  throw new ProjectDataError(
    'PROJECT_DATA106',
    `Selected asset target cannot be placed in the production export tree: ${row.targetKind}.`
  );
}

function readSequenceHierarchy(
  session: ProjectDataSession,
  sequenceId: string
): {
  sequencePosition: number;
  sequenceTitle: string;
} {
  const row = session.sqlite
    .prepare(
      `select position as sequencePosition, title as sequenceTitle
       from sequence
       where id = ?`
    )
    .get(sequenceId) as
    | {
        sequencePosition: number;
        sequenceTitle: string;
      }
    | undefined;
  if (!row) {
    throw new ProjectDataError(
      'PROJECT_DATA108',
      `Sequence target was not found for production export: ${sequenceId}.`
    );
  }
  return row;
}

function readSceneHierarchy(
  session: ProjectDataSession,
  sceneId: string
): {
  sequencePosition: number;
  sequenceTitle: string;
  scenePosition: number;
  sceneTitle: string;
} {
  const row = session.sqlite
    .prepare(
      `select s.position as sequencePosition, s.title as sequenceTitle,
        sc.position as scenePosition, sc.title as sceneTitle
       from scene sc
       join sequence s on s.id = sc.sequence_id
       where sc.id = ?`
    )
    .get(sceneId) as
    | {
        sequencePosition: number;
        sequenceTitle: string;
        scenePosition: number;
        sceneTitle: string;
      }
    | undefined;
  if (!row) {
    throw new ProjectDataError(
      'PROJECT_DATA109',
      `Scene target was not found for production export: ${sceneId}.`
    );
  }
  return row;
}

function readClipHierarchy(
  session: ProjectDataSession,
  clipId: string
): {
  sequencePosition: number;
  sequenceTitle: string;
  scenePosition: number;
  sceneTitle: string;
  clipPosition: number;
  clipTitle: string;
} {
  const row = session.sqlite
    .prepare(
      `select s.position as sequencePosition, s.title as sequenceTitle,
        sc.position as scenePosition, sc.title as sceneTitle,
        c.position as clipPosition, c.title as clipTitle
       from clip c
       join scene sc on sc.id = c.scene_id
       join sequence s on s.id = sc.sequence_id
       where c.id = ?`
    )
    .get(clipId) as
    | {
        sequencePosition: number;
        sequenceTitle: string;
        scenePosition: number;
        sceneTitle: string;
        clipPosition: number;
        clipTitle: string;
      }
    | undefined;
  if (!row) {
    throw new ProjectDataError(
      'PROJECT_DATA107',
      `Clip target was not found for production export: ${clipId}.`
    );
  }
  return row;
}

function exportFileName(row: SelectedAssetRow): string {
  const extension = path.posix.extname(row.sourceProjectRelativePath);
  const baseName = roleFileBaseName(row.role);
  const orderedBaseName =
    row.selectionOrder > 1 ? `${baseName}-${row.selectionOrder}` : baseName;
  return `${orderedBaseName}${extension}`;
}

function roleFileBaseName(role: string): string {
  switch (role) {
    case 'clip_video':
    case 'clip-video':
    case 'video':
      return 'video';
    case 'locale_video_override':
    case 'locale-video-override':
      return 'video-override';
    case 'locale_audio_override':
    case 'locale-audio-override':
      return 'audio-override';
    case 'word_timing':
    case 'word-timing':
      return 'word-timing';
    case 'sound_effect':
    case 'sound-effect':
      return 'sound-effect';
    case 'final_graphic':
    case 'final-graphic':
      return 'graphic';
    case 'title_card':
    case 'title-card':
      return 'title-card';
    default:
      return slugify(role);
  }
}

function sharedFolderName(role: string, variant: ProductionExportVariant): string {
  if (role === 'music') {
    return 'Music';
  }
  if (role === 'sound-effect' || role === 'sound_effect') {
    return 'Sound Effects';
  }
  if (role === 'subtitles') {
    return 'Subtitles';
  }
  if (role === 'final-graphic' || role === 'final_graphic' || role === 'title-card' || role === 'title_card') {
    return 'Graphics';
  }
  if (role === 'locale-video-override' || role === 'locale_video_override') {
    return 'Video Overrides';
  }
  return variant.kind === 'localized' ? 'Audio' : 'Audio';
}

function buildMerkleTreeHash(
  rootProjectRelativePath: ProjectRelativePath,
  variant: ProductionExportVariant,
  files: DesiredExportFile[]
): string {
  const root = createFolderNode(rootProjectRelativePath);
  for (const file of files) {
    addFileNode(root, file);
  }
  const rootHash = hashFolderNode(root);
  return hashJson({
    type: 'variant',
    variant,
    rootProjectRelativePath,
    rootHash,
  });
}

interface FolderNode {
  name: string;
  folders: Map<string, FolderNode>;
  files: Map<string, string>;
}

function createFolderNode(name: string): FolderNode {
  return { name, folders: new Map(), files: new Map() };
}

function addFileNode(root: FolderNode, file: DesiredExportFile): void {
  const relativeTarget = path.posix.relative(
    file.variantRootProjectRelativePath,
    file.targetProjectRelativePath
  );
  const segments = relativeTarget.split('/');
  let current = root;
  for (const segment of segments.slice(0, -1)) {
    const existing = current.folders.get(segment) ?? createFolderNode(segment);
    current.folders.set(segment, existing);
    current = existing;
  }
  current.files.set(
    segments[segments.length - 1] ?? file.targetProjectRelativePath,
    hashJson({
      type: 'file',
      assetId: file.assetId,
      relationshipId: file.relationshipId,
      assetFileId: file.assetFileId,
      role: file.role,
      sourceContentHash: file.sourceContentHash,
      sourceSizeBytes: file.sourceSizeBytes,
      targetProjectRelativePath: file.targetProjectRelativePath,
    })
  );
}

function hashFolderNode(node: FolderNode): string {
  const folders = [...node.folders.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, child]) => [name, hashFolderNode(child)]);
  const files = [...node.files.entries()].sort(([left], [right]) =>
    left.localeCompare(right)
  );
  return hashJson({
    type: 'folder',
    name: node.name,
    folders,
    files,
  });
}

function hashJson(value: unknown): string {
  return crypto.createHash('sha256').update(JSON.stringify(value)).digest('hex');
}

async function syncVariant(input: {
  projectFolder: string;
  plan: VariantPlan;
  previousVariant: ProductionExportVariantManifest | null;
  dryRun: boolean;
}): Promise<ExportCounters> {
  if (input.previousVariant?.treeHash === input.plan.treeHash) {
    let copied = 0;
    let skipped = 0;
    for (const file of input.plan.files) {
      const targetPath = resolveProjectRelativePath(
        input.projectFolder,
        file.targetProjectRelativePath
      );
      if (await fileExists(targetPath)) {
        skipped += 1;
        continue;
      }
      const sourcePath = resolveProjectRelativePath(
        input.projectFolder,
        file.sourceProjectRelativePath
      );
      if (!input.dryRun) {
        await fs.mkdir(path.dirname(targetPath), { recursive: true });
        await fs.copyFile(sourcePath, targetPath);
      }
      copied += 1;
    }
    return { copied, skipped, pruned: 0 };
  }

  const previousFiles = new Map(
    (input.previousVariant?.files ?? []).map((file) => [
      file.targetProjectRelativePath,
      file,
    ])
  );
  let copied = 0;
  let skipped = 0;
  for (const file of input.plan.files) {
    const previousFile = previousFiles.get(file.targetProjectRelativePath);
    if (
      previousFile?.sourceContentHash === file.sourceContentHash &&
      (await fileExists(
        resolveProjectRelativePath(input.projectFolder, file.targetProjectRelativePath)
      ))
    ) {
      skipped += 1;
      continue;
    }

    const sourcePath = resolveProjectRelativePath(
      input.projectFolder,
      file.sourceProjectRelativePath
    );
    const targetPath = resolveProjectRelativePath(
      input.projectFolder,
      file.targetProjectRelativePath
    );
    if (!input.dryRun) {
      await fs.mkdir(path.dirname(targetPath), { recursive: true });
      await fs.copyFile(sourcePath, targetPath);
    }
    copied += 1;
  }
  return { copied, skipped, pruned: 0 };
}

async function prunePreviousFiles(input: {
  projectFolder: string;
  previousFiles: Map<string, ProductionExportFileManifest>;
  desiredTargetPaths: Set<string>;
  dryRun: boolean;
}): Promise<number> {
  let pruned = 0;
  for (const targetPath of input.previousFiles.keys()) {
    if (input.desiredTargetPaths.has(targetPath)) {
      continue;
    }
    const absoluteTargetPath = resolveProjectRelativePath(
      input.projectFolder,
      normalizeProjectRelativePath(targetPath)
    );
    if (!(await fileExists(absoluteTargetPath))) {
      continue;
    }
    if (!input.dryRun) {
      await fs.unlink(absoluteTargetPath);
    }
    pruned += 1;
  }
  return pruned;
}

async function fileExists(filePath: string): Promise<boolean> {
  try {
    await fs.access(filePath);
    return true;
  } catch {
    return false;
  }
}

async function readManifest(
  projectFolder: string,
  projectId: string
): Promise<ProductionExportManifest | null> {
  const manifestPath = resolveProjectRelativePath(projectFolder, MANIFEST_PATH);
  if (!(await fileExists(manifestPath))) {
    return null;
  }
  try {
    const manifest = JSON.parse(
      await fs.readFile(manifestPath, 'utf8')
    ) as ProductionExportManifest;
    if (manifest.schemaVersion !== 1 || manifest.projectId !== projectId) {
      throw new ProjectDataError(
        'PROJECT_DATA108',
        'Production export manifest is not valid for this project.'
      );
    }
    return manifest;
  } catch (error) {
    if (error instanceof ProjectDataError) {
      throw error;
    }
    throw new ProjectDataError(
      'PROJECT_DATA109',
      'Production export manifest could not be read.'
    );
  }
}

async function writeManifest(
  projectFolder: string,
  manifest: ProductionExportManifest
): Promise<void> {
  const manifestPath = resolveProjectRelativePath(projectFolder, MANIFEST_PATH);
  await fs.mkdir(path.dirname(manifestPath), { recursive: true });
  await fs.writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, 'utf8');
}

function findPreviousVariant(
  manifest: ProductionExportManifest | null,
  variant: ProductionExportVariant
): ProductionExportVariantManifest | null {
  return (
    manifest?.variants.find((entry) => {
      if (variant.kind === 'master') {
        return entry.variant === 'master';
      }
      return entry.variant === 'localized' && entry.localeId === variant.localeId;
    }) ?? null
  );
}

function toManifestVariant(plan: VariantPlan): ProductionExportVariantManifest {
  return {
    variant: plan.variant.kind === 'master' ? 'master' : 'localized',
    localeId: plan.variant.kind === 'localized' ? plan.variant.localeId : null,
    rootProjectRelativePath: plan.rootProjectRelativePath,
    treeHash: plan.treeHash,
    files: plan.files.map((file) => ({
      assetId: file.assetId,
      relationshipId: file.relationshipId,
      assetFileId: file.assetFileId,
      sourceProjectRelativePath: file.sourceProjectRelativePath,
      targetProjectRelativePath: file.targetProjectRelativePath,
      sourceContentHash: file.sourceContentHash,
      sourceSizeBytes: file.sourceSizeBytes,
      sourceModifiedAt: file.sourceModifiedAt,
      role: file.role,
    })),
  };
}

function requiredLocaleTag(session: ProjectDataSession, localeId: string): string {
  const row = session.sqlite
    .prepare('select locale_tag as localeTag from project_locale where id = ?')
    .get(localeId) as { localeTag: string } | undefined;
  if (!row) {
    throw new ProjectDataError(
      'PROJECT_DATA103',
      `Requested production export locale was not found: ${localeId}.`
    );
  }
  return row.localeTag;
}

function requiredTargetId(row: SelectedAssetRow): string {
  if (!row.targetId) {
    throw new ProjectDataError(
      'PROJECT_DATA110',
      `Production export asset relationship is missing its target id: ${row.relationshipId}.`
    );
  }
  return row.targetId;
}

function numberedSlug(position: number, title: string): string {
  return `${String(position).padStart(2, '0')}-${slugify(title)}`;
}

function slugify(input: string): string {
  return (
    input
      .trim()
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-+|-+$/g, '') || 'untitled'
  );
}
