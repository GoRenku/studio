import { realpath, stat } from 'node:fs/promises';
import path from 'node:path';
import type {
  GenerationOutputMediaKind,
  GenerationReference,
  GenerationReferenceCatalogItem,
  GenerationReferenceCatalogPage,
  GenerationReferenceSelection,
  GenerationReferenceSlotSelectionInput,
  GenerationSpec,
} from '../../client/generation.js';
import type { ProjectRelativePath } from '../../client/project.js';
import {
  listGenerationReferenceAssetFileRecords,
  readGenerationReferenceAssetFileRecord,
} from '../database/access/generation-references.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import {
  normalizeProjectRelativePath,
  resolveProjectRelativePath,
} from '../files/project-relative-paths.js';
import { isPathInside } from '../files/project-paths.js';
import { ProjectDataError } from '../project-data-error.js';
import { readGenerationPurpose } from './purposes.js';
import { readGenerationSpec, updateGenerationSpec } from './specs.js';

export interface ListGenerationReferencesInput {
  session: DatabaseSession;
  assetId?: string;
  assetFileIds?: string[];
  mediaKind?: GenerationOutputMediaKind;
  owner?: { kind: string; id: string };
  assetRole?: string;
  search?: string;
  cursor?: string | null;
  limit?: number;
}

export function listGenerationReferences(
  input: ListGenerationReferencesInput
): GenerationReferenceCatalogPage {
  const search = input.search?.trim().toLocaleLowerCase();
  const items = listGenerationReferenceAssetFileRecords(input.session)
    .flatMap((record): GenerationReferenceCatalogItem[] => {
      const { asset, file, owner, generationRunId } = record;
      if (!isGenerationMediaKind(file.mediaKind)) {
        return [];
      }
      const role = owner?.role ?? file.role;
      const label = asset.title.trim() || file.role;
      if (input.mediaKind && file.mediaKind !== input.mediaKind) {
        return [];
      }
      if (input.assetId && file.assetId !== input.assetId) {
        return [];
      }
      if (input.assetFileIds && !input.assetFileIds.includes(file.id)) {
        return [];
      }
      if (
        input.owner &&
        (owner?.kind !== input.owner.kind || owner.id !== input.owner.id)
      ) {
        return [];
      }
      if (input.assetRole && role !== input.assetRole) {
        return [];
      }
      if (
        search &&
        !`${label} ${role} ${file.projectRelativePath}`
          .toLocaleLowerCase()
          .includes(search)
      ) {
        return [];
      }
      return [{
        reference: {
          kind: 'asset-file',
          assetId: file.assetId,
          assetFileId: file.id,
        },
        label,
        mediaKind: file.mediaKind,
        mimeType: file.mimeType,
        sizeBytes: file.sizeBytes,
        width: file.width,
        height: file.height,
        durationSeconds: file.durationSeconds,
        owner: owner ? { kind: owner.kind, id: owner.id } : null,
        role,
        provenance: {
          origin: asset.origin,
          ...(generationRunId
            ? { generationRunId }
            : {}),
        },
        projectRelativePath: normalizeProjectRelativePath(
          file.projectRelativePath
        ),
      }];
    })
    .sort((left, right) =>
      `${left.label}\0${referenceKey(left.reference)}`.localeCompare(
        `${right.label}\0${referenceKey(right.reference)}`
      )
    );
  const afterCursor = input.cursor
    ? items.filter((item) => itemCursor(item) > input.cursor!)
    : items;
  const limit = Math.min(Math.max(input.limit ?? 60, 1), 200);
  const pageItems = afterCursor.slice(0, limit);
  return {
    items: pageItems,
    nextCursor:
      afterCursor.length > limit && pageItems.length > 0
        ? itemCursor(pageItems[pageItems.length - 1]!)
        : null,
  };
}

export function setGenerationReferenceSlotSelection(input: {
  specId: string;
  selection: GenerationReferenceSlotSelectionInput;
  session: DatabaseSession;
  now: string;
}) {
  const record = readGenerationSpec({ id: input.specId, session: input.session });
  return updateGenerationSpec({
    id: record.id,
    spec: applyGenerationReferenceSlotSelection(record.spec, input.selection),
    purpose: readGenerationPurpose(record.spec.purpose),
    session: input.session,
    now: input.now,
  });
}

export function applyGenerationReferenceSlotSelection(
  spec: GenerationSpec,
  input: GenerationReferenceSlotSelectionInput
): GenerationSpec {
  const current = spec.references.find((selection) =>
    placementsEqual(selection.placement, input.placement)
  );
  const references = spec.references.filter((selection) =>
    !placementsEqual(selection.placement, input.placement)
  );
  if (!input.reference) {
    return { ...spec, references };
  }
  const providerField = input.providerField === undefined
    ? current?.providerField
    : input.providerField ?? undefined;
  references.push({
    placement: input.placement,
    ...(providerField ? { providerField } : {}),
    ...(current?.promptMention ? { promptMention: current.promptMention } : {}),
    reference: input.reference,
  });
  return { ...spec, references };
}

export function applyGenerationGenericReferences(
  spec: GenerationSpec,
  genericReferences: GenerationReference[]
): GenerationSpec {
  const current = new Map(
    spec.references
      .filter((selection) => selection.placement.kind === 'additional')
      .map((selection) => [referenceKey(selection.reference), selection])
  );
  const references = spec.references.filter(
    (selection) => selection.placement.kind !== 'additional'
  );
  for (const reference of genericReferences) {
    const existing = current.get(referenceKey(reference));
    references.push({
      placement: { kind: 'additional' },
      ...(existing?.providerField
        ? { providerField: existing.providerField }
        : {}),
      ...(existing?.promptMention
        ? { promptMention: existing.promptMention }
        : {}),
      reference,
    });
  }
  return { ...spec, references };
}

export function allocateGenerationReferencePromptMention(input: {
  spec: GenerationSpec;
  placement: GenerationReferenceSelection['placement'];
}): GenerationSpec {
  const index = input.spec.references.findIndex((selection) =>
    placementsEqual(selection.placement, input.placement)
  );
  const selection = input.spec.references[index];
  if (!selection || selection.promptMention) {
    return input.spec;
  }
  const nextPromptMentionNumber = effectiveNextPromptMentionNumber(input.spec);
  const references = [...input.spec.references];
  references[index] = {
    ...selection,
    promptMention: `@Reference${nextPromptMentionNumber}`,
  };
  return {
    ...input.spec,
    references,
    nextPromptMentionNumber: nextPromptMentionNumber + 1,
  };
}

function effectiveNextPromptMentionNumber(spec: GenerationSpec): number {
  if (spec.nextPromptMentionNumber !== undefined) {
    return spec.nextPromptMentionNumber;
  }
  const largest = spec.references.reduce((maximum, selection) => {
    const match = /^@Reference([1-9]\d*)$/.exec(selection.promptMention ?? '');
    return match ? Math.max(maximum, Number(match[1])) : maximum;
  }, 0);
  return largest + 1;
}

export async function resolveGenerationReference(input: {
  session: DatabaseSession;
  projectFolder: string;
  reference: GenerationReference;
}): Promise<GenerationReferenceCatalogItem | null> {
  if (input.reference.kind === 'project-file') {
    let projectFile;
    try {
      projectFile = await resolveGenerationReferenceProjectFile({
        projectFolder: input.projectFolder,
        projectRelativePath: input.reference.projectRelativePath,
      });
    } catch {
      return null;
    }
    return {
      reference: input.reference,
      label: path.posix.basename(projectFile.projectRelativePath),
      mediaKind: projectFile.mediaKind,
      mimeType: projectFile.mimeType,
      sizeBytes: projectFile.sizeBytes,
      width: null,
      height: null,
      durationSeconds: null,
      owner: null,
      role: 'project-file',
      provenance: { origin: 'project-file' },
      projectRelativePath: projectFile.projectRelativePath,
    };
  }

  const record = readGenerationReferenceAssetFileRecord(input.session, {
    assetId: input.reference.assetId,
    assetFileId: input.reference.assetFileId,
  });
  if (!record || !isGenerationMediaKind(record.file.mediaKind)) {
    return null;
  }
  const mediaKind = record.file.mediaKind;
  const { asset, file, owner, generationRunId } = record;
  const projectRelativePath = normalizeProjectRelativePath(file.projectRelativePath);
  if (!(await projectFileIsAvailable(input.projectFolder, projectRelativePath))) {
    return null;
  }
  return {
    reference: input.reference,
    label: asset.title.trim() || file.role,
    mediaKind,
    mimeType: file.mimeType,
    sizeBytes: file.sizeBytes,
    width: file.width,
    height: file.height,
    durationSeconds: file.durationSeconds,
    owner: owner ? { kind: owner.kind, id: owner.id } : null,
    role: owner?.role ?? file.role,
    provenance: {
      origin: asset.origin,
      ...(generationRunId ? { generationRunId } : {}),
    },
    projectRelativePath,
  };
}

function referenceKey(reference: GenerationReference): string {
  return reference.kind === 'asset-file'
    ? `${reference.assetId}:${reference.assetFileId}`
    : reference.projectRelativePath;
}

function placementsEqual(
  left: GenerationReferenceSelection['placement'],
  right: GenerationReferenceSelection['placement']
): boolean {
  return left.kind === 'slot' && right.kind === 'slot' &&
    placementKey(left) === placementKey(right);
}

function placementKey(
  placement: Extract<GenerationReferenceSelection['placement'], { kind: 'slot' }>
): string {
  return [
    placement.sectionId,
    placement.slotId,
    placement.subject?.kind ?? '',
    placement.subject?.id ?? '',
  ].join(':');
}

function itemCursor(item: GenerationReferenceCatalogItem): string {
  return `${item.label}\0${referenceKey(item.reference)}`;
}

function isGenerationMediaKind(
  mediaKind: string
): mediaKind is GenerationOutputMediaKind {
  return mediaKind === 'image' || mediaKind === 'audio' || mediaKind === 'video';
}

function mediaKindForPath(
  projectRelativePath: ProjectRelativePath
): GenerationOutputMediaKind | null {
  const mimeType = mimeTypeForPath(projectRelativePath);
  if (mimeType?.startsWith('image/')) {
    return 'image';
  }
  if (mimeType?.startsWith('audio/')) {
    return 'audio';
  }
  if (mimeType?.startsWith('video/')) {
    return 'video';
  }
  return null;
}

function mimeTypeForPath(projectRelativePath: ProjectRelativePath): string | null {
  switch (path.posix.extname(projectRelativePath).toLowerCase()) {
    case '.jpg':
    case '.jpeg':
      return 'image/jpeg';
    case '.png':
      return 'image/png';
    case '.webp':
      return 'image/webp';
    case '.wav':
      return 'audio/wav';
    case '.mp3':
      return 'audio/mpeg';
    case '.m4a':
      return 'audio/mp4';
    case '.mp4':
      return 'video/mp4';
    case '.mov':
      return 'video/quicktime';
    default:
      return null;
  }
}

export async function resolveGenerationReferenceProjectFile(input: {
  projectFolder: string;
  projectRelativePath: string;
}): Promise<{
  absolutePath: string;
  projectRelativePath: ProjectRelativePath;
  mediaKind: GenerationOutputMediaKind;
  mimeType: string;
  sizeBytes: number;
}> {
  const projectRelativePath = normalizeProjectRelativePath(
    input.projectRelativePath
  );
  const mediaKind = mediaKindForPath(projectRelativePath);
  const mimeType = mimeTypeForPath(projectRelativePath);
  if (!mediaKind || !mimeType) {
    throw new ProjectDataError(
      'CORE_GENERATION_REFERENCE_FILE_MEDIA_UNSUPPORTED',
      'Generation reference files must use a supported image, audio, or video format.'
    );
  }
  try {
    const [realProjectFolder, realFilePath] = await Promise.all([
      realpath(path.resolve(input.projectFolder)),
      realpath(resolveProjectRelativePath(input.projectFolder, projectRelativePath)),
    ]);
    if (!isPathInside(realProjectFolder, realFilePath)) {
      throw new ProjectDataError(
        'CORE_GENERATION_REFERENCE_FILE_OUTSIDE_PROJECT',
        'Generation reference files must resolve inside the project.'
      );
    }
    const fileStats = await stat(realFilePath);
    if (!fileStats.isFile()) {
      throw new ProjectDataError(
        'CORE_GENERATION_REFERENCE_FILE_NOT_FOUND',
        'Generation reference file was not found.'
      );
    }
    return {
      absolutePath: realFilePath,
      projectRelativePath,
      mediaKind,
      mimeType,
      sizeBytes: fileStats.size,
    };
  } catch (error) {
    if (error instanceof ProjectDataError) {
      throw error;
    }
    throw new ProjectDataError(
      'CORE_GENERATION_REFERENCE_FILE_NOT_FOUND',
      'Generation reference file was not found inside the project.'
    );
  }
}

async function projectFileIsAvailable(
  projectFolder: string,
  projectRelativePath: ProjectRelativePath,
): Promise<boolean> {
  try {
    await resolveGenerationReferenceProjectFile({
      projectFolder,
      projectRelativePath,
    });
    return true;
  } catch {
    return false;
  }
}
