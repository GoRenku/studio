import { createProjectDataService, type ImageEditLineageEntry, type ImageEditTarget, type StudioProjectRef } from '@gorenku/studio-core/server';
import type { LookbookResource } from '@gorenku/studio-core/client';
import type { PanelMediaRegistry } from '../panel-sessions/media-registry.js';
import type { ImageEditSession, ImageEditVersion } from './contracts.js';
import { imageEditBase } from './edit-base.js';
import type { ImageEditSessionRecord, ImageEditState } from './session-state.js';

interface ImageEditStyleReferenceRecord {
  assetFileId: string;
  projectRelativePath: string;
  name: string | null;
  lookbook: 'production' | 'storyboard';
  lookbookName: string;
}

export async function readImageEditTargetsFor(projectRef: StudioProjectRef, assetFileIds: string[], homeDir?: string): Promise<ImageEditTarget[]> {
  if (assetFileIds.length === 0) return [];
  return createProjectDataService().readImageEditTargets({ projectName: projectRef.name, homeDir, assetFileIds });
}

/** Style references are the sheets of the Project's Production and Storyboard Lookbooks. */
export async function readImageEditStyleReferences(projectRef: StudioProjectRef, homeDir?: string): Promise<ImageEditStyleReferenceRecord[]> {
  const lookbooks = await createProjectDataService().readProjectLookbooks({ projectName: projectRef.name, homeDir });
  return [
    ...styleReferencesOf(lookbooks.production, 'production'),
    ...styleReferencesOf(lookbooks.storyboard, 'storyboard'),
  ];
}

export async function readImageEditSession(state: ImageEditState, sessionId: string, homeDir?: string): Promise<ImageEditSession> {
  return projectImageEditSession(state.record(sessionId), homeDir);
}

export async function readImageEditLineageFor(projectRef: StudioProjectRef, sourceAssetFileId: string, homeDir?: string): Promise<ImageEditLineageEntry[]> {
  return createProjectDataService().readImageEditLineage({ projectName: projectRef.name, homeDir, sourceAssetFileId });
}

/**
 * Re-reads Core on every projection. Versions include the opening source and each action base's
 * lineage, so Studio deletions, selection changes and edits recovered in chat all show up.
 */
export async function projectImageEditSession(record: ImageEditSessionRecord, homeDir?: string): Promise<ImageEditSession> {
  const lineages = await Promise.all(record.versionSourceAssetFileIds.map((sourceAssetFileId) => readImageEditLineageFor(record.projectRef, sourceAssetFileId, homeDir)));
  const entries = new Map<string, ImageEditLineageEntry>();
  for (const entry of lineages.flat()) {
    if (!entries.has(entry.target.assetFile.id)) entries.set(entry.target.assetFile.id, entry);
  }
  const lineage = [...entries.values()];
  const styleReferences = await readImageEditStyleReferences(record.projectRef, homeDir);
  const selectedAssetFileId = record.selectable ? await readSelectedAssetFileId(record, lineage, homeDir) : null;
  const outside = selectedAssetFileId && !lineage.some((entry) => entry.target.assetFile.id === selectedAssetFileId)
    ? (await readImageEditTargetsFor(record.projectRef, [selectedAssetFileId], homeDir)).map((target) => ({ target, parentAssetFileId: null }))
    : [];
  const versions: ImageEditVersion[] = [...lineage, ...outside]
    .map((entry) => projectVersion(entry.target, entry.parentAssetFileId, selectedAssetFileId, record.media));
  return structuredClone({
    sessionId: record.sessionId,
    revision: record.revision,
    panel: record.panel,
    route: record.route,
    owner: { kind: record.owner.kind, name: record.ownerName },
    imageType: record.imageType,
    selectable: record.selectable,
    versions,
    editBaseAssetFileId: imageEditBase({
      selectable: record.selectable,
      selectedAssetFileId,
      lineageVersionIds: lineage.map((entry) => entry.target.assetFile.id),
    }),
    styleReferences: styleReferences.map((reference) => ({
      assetFileId: reference.assetFileId,
      name: reference.name,
      lookbook: reference.lookbook,
      lookbookName: reference.lookbookName,
      imageUri: record.media.uri(reference.projectRelativePath),
    })),
    action: record.action,
    lastCompletedAction: record.lastCompletedAction,
    initial: record.initial,
  });
}

/** The target's current selection; read from any active image of the same owner and type. */
async function readSelectedAssetFileId(record: ImageEditSessionRecord, lineage: ImageEditLineageEntry[], homeDir?: string): Promise<string | null> {
  if (lineage[0]) return lineage[0].target.selectedAssetFileId;
  const [anyActive] = await createProjectDataService().listAssetFiles({
    projectName: record.projectRef.name, homeDir, owner: record.owner, type: record.imageType, mediaKind: 'image',
  });
  return anyActive ? (await readImageEditTargetsFor(record.projectRef, [anyActive.id], homeDir))[0]!.selectedAssetFileId : null;
}

function projectVersion(target: ImageEditTarget, parentAssetFileId: string | null, selectedAssetFileId: string | null, media: PanelMediaRegistry): ImageEditVersion {
  return {
    assetFileId: target.assetFile.id,
    takeNumber: target.takeNumber,
    imageUri: media.uri(target.assetFile.projectRelativePath),
    parentAssetFileId,
    selected: target.assetFile.id === selectedAssetFileId,
  };
}

function styleReferencesOf(resource: LookbookResource | null, lookbook: 'production' | 'storyboard'): ImageEditStyleReferenceRecord[] {
  if (!resource) return [];
  return resource.sheets.map((sheet) => ({
    assetFileId: sheet.assetFile.id,
    projectRelativePath: sheet.assetFile.projectRelativePath,
    name: sheet.assetFile.title ?? null,
    lookbook,
    lookbookName: resource.lookbook.name,
  }));
}
