import { createDiagnosticError } from '@gorenku/studio-diagnostics';
import type {
  GenerationPreviewRequest,
  GenerationPreviewRequestReference,
  ProjectRelativePath,
  SceneShot,
  SceneShotVideoTakeTarget,
  StudioGenerationPreviewSubject,
} from '../../client/index.js';
import { ProjectDataError } from '../project-data-error.js';
import { readCastMemberRecord } from '../database/access/cast-members.js';
import { resolveProjectAssetFileById } from '../resources/assets.js';
import { buildShotVideoTakeContext } from '../media-generation/purposes/shot-video-take/authoring/context.js';
import { sameShotIds } from '../media-generation/purposes/shot-video-take/authoring/take-context.js';
import { withMediaGenerationProjectSession } from '../media-generation/lifecycle/project-session.js';

export interface GenerationPreviewReferenceFileAccess {
  assetId: string;
  assetFileId: string;
  mediaKind: 'image' | 'audio' | 'video';
  projectRelativePath: ProjectRelativePath;
}

export async function resolveGenerationPreviewReferenceFiles(input: {
  projectName?: string;
  homeDir?: string;
  preview: GenerationPreviewRequest;
}): Promise<GenerationPreviewReferenceFileAccess[]> {
  const projectName = input.projectName ?? input.preview.project.name;
  return Promise.all(
    input.preview.references.map(async (reference, index) => {
      const file = await resolvePreviewReferenceFile({
        projectName,
        homeDir: input.homeDir,
        reference,
        index,
      });
      return {
        assetId: file.assetId,
        assetFileId: file.assetFileId,
        mediaKind: file.mediaKind,
        projectRelativePath: file.projectRelativePath,
      };
    })
  );
}

export async function buildGenerationPreviewSubject(input: {
  projectName?: string;
  homeDir?: string;
  preview: GenerationPreviewRequest;
}): Promise<StudioGenerationPreviewSubject> {
  const projectLabel =
    meaningfulLabel(input.preview.project.title, input.preview.project.id) ??
    input.preview.project.name;
  if (input.preview.target.kind === 'castMember') {
    const castMember = await readPreviewCastMember({
      projectName: input.projectName ?? input.preview.project.name,
      homeDir: input.homeDir,
      castMemberId: input.preview.target.id,
    });
    return {
      projectLabel,
      ...optionalLabel(
        'castMemberLabel',
        meaningfulLabel(castMember.name, castMember.id) ?? castMember.handle
      ),
    };
  }

  if (input.preview.target.kind !== 'sceneShotVideoTake') {
    return { projectLabel };
  }

  const context = await buildShotVideoTakeContext({
    projectName: input.projectName ?? input.preview.project.name,
    homeDir: input.homeDir,
    takeId: input.preview.target.takeId,
  });
  validateSubjectTarget(input.preview.target, context.target);

  return {
    projectLabel:
      meaningfulLabel(context.project.title, context.project.id) ?? projectLabel,
    ...optionalLabel(
      'sceneLabel',
      meaningfulLabel(context.scene.title, context.scene.id)
    ),
    ...optionalLabel(
      'takeLabel',
      meaningfulLabel(context.take.title, context.take.takeId)
    ),
    ...optionalLabel(
      'shotLabel',
      shotOrderLabel(context.displayShots, input.preview.target.shotIds)
    ),
  };
}

async function readPreviewCastMember(input: {
  projectName: string;
  homeDir?: string;
  castMemberId: string;
}): Promise<{ id: string; name: string; handle: string }> {
  return withMediaGenerationProjectSession(input, ({ session }) => {
    const castMember = readCastMemberRecord(session, input.castMemberId);
    if (!castMember) {
      throw new ProjectDataError(
        'CORE_GENERATION_PREVIEW_TARGET_NOT_FOUND',
        `Generation preview cast member was not found: ${input.castMemberId}.`
      );
    }
    return {
      id: castMember.id,
      name: castMember.name,
      handle: castMember.handle,
    };
  });
}

async function resolvePreviewReferenceFile(input: {
  projectName: string;
  homeDir?: string;
  reference: GenerationPreviewRequestReference;
  index: number;
}): Promise<GenerationPreviewReferenceFileAccess> {
  const path = ['references', String(input.index)];
  let resolved: Awaited<ReturnType<typeof resolveProjectAssetFileById>>;
  try {
    resolved = await resolveProjectAssetFileById({
      projectName: input.projectName,
      homeDir: input.homeDir,
      assetId: input.reference.assetId,
      assetFileId: input.reference.assetFileId,
    });
  } catch (error) {
    throw referenceResolutionError(error, path);
  }

  if (!isPreviewMediaKind(resolved.file.mediaKind)) {
    throw new ProjectDataError(
      'CORE_GENERATION_PREVIEW_REFERENCE_MEDIA_KIND_UNSUPPORTED',
      'Generation preview reference file must be image, audio, or video media.',
      {
        issues: [
          createDiagnosticError(
            'CORE_GENERATION_PREVIEW_REFERENCE_MEDIA_KIND_UNSUPPORTED',
            `Generation preview reference file media kind is not supported: ${resolved.file.mediaKind}.`,
            { path: [...path, 'assetFileId'], context: 'Generation preview reference resolution' },
            'Use an image, audio, or video asset file for preview references.'
          ),
        ],
      }
    );
  }
  if (resolved.file.mediaKind !== input.reference.kind) {
    throw new ProjectDataError(
      'CORE_GENERATION_PREVIEW_REFERENCE_MEDIA_KIND_MISMATCH',
      'Generation preview reference kind does not match the asset file media kind.',
      {
        issues: [
          createDiagnosticError(
            'CORE_GENERATION_PREVIEW_REFERENCE_MEDIA_KIND_MISMATCH',
            `Generation preview reference kind ${input.reference.kind} does not match asset file media kind ${resolved.file.mediaKind}.`,
            { path: [...path, 'kind'], context: 'Generation preview reference resolution' },
            'Use a reference kind that matches the resolved project asset file.'
          ),
        ],
      }
    );
  }

  return {
    assetId: resolved.assetId,
    assetFileId: resolved.file.id,
    mediaKind: resolved.file.mediaKind,
    projectRelativePath: resolved.file.projectRelativePath,
  };
}

function referenceResolutionError(error: unknown, path: string[]): ProjectDataError {
  if (!(error instanceof ProjectDataError)) {
    return new ProjectDataError(
      'CORE_GENERATION_PREVIEW_REFERENCE_FILE_NOT_FOUND',
      'Generation preview reference file could not be resolved.'
    );
  }
  const mapping = previewReferenceErrorMapping(error.code);
  if (!mapping) {
    return error;
  }
  return new ProjectDataError(mapping.code, mapping.message, {
    issues: [
      createDiagnosticError(
        mapping.code,
        mapping.message,
        { path: [...path, mapping.pathKey], context: 'Generation preview reference resolution' },
        mapping.suggestion
      ),
    ],
  });
}

function previewReferenceErrorMapping(code: string):
  | {
      code: string;
      message: string;
      pathKey: 'assetId' | 'assetFileId';
      suggestion: string;
    }
  | null {
  switch (code) {
    case 'CORE_PROJECT_ASSET_NOT_FOUND':
      return {
        code: 'CORE_GENERATION_PREVIEW_REFERENCE_ASSET_NOT_FOUND',
        message: 'Generation preview reference asset was not found.',
        pathKey: 'assetId',
        suggestion: 'Use an assetId that exists in the current project.',
      };
    case 'CORE_PROJECT_ASSET_DISCARDED':
      return {
        code: 'CORE_GENERATION_PREVIEW_REFERENCE_ASSET_DISCARDED',
        message: 'Generation preview reference asset is discarded.',
        pathKey: 'assetId',
        suggestion: 'Use an active project asset.',
      };
    case 'CORE_PROJECT_ASSET_FILE_NOT_FOUND':
      return {
        code: 'CORE_GENERATION_PREVIEW_REFERENCE_FILE_NOT_FOUND',
        message: 'Generation preview reference asset file was not found.',
        pathKey: 'assetFileId',
        suggestion: 'Use an assetFileId that belongs to the referenced asset.',
      };
    case 'CORE_PROJECT_ASSET_FILE_DISCARDED':
      return {
        code: 'CORE_GENERATION_PREVIEW_REFERENCE_FILE_DISCARDED',
        message: 'Generation preview reference asset file is discarded.',
        pathKey: 'assetFileId',
        suggestion: 'Use an active project asset file.',
      };
    default:
      return null;
  }
}

function validateSubjectTarget(
  previewTarget: SceneShotVideoTakeTarget,
  target: SceneShotVideoTakeTarget
): void {
  if (
    previewTarget.sceneId !== target.sceneId ||
    previewTarget.takeId !== target.takeId ||
    !sameShotIds(previewTarget.shotIds, target.shotIds)
  ) {
    throw new ProjectDataError(
      'CORE_GENERATION_PREVIEW_TARGET_STALE',
      'Generation preview target does not match the current Scene Shot Video Take.',
      {
        issues: [
          createDiagnosticError(
            'CORE_GENERATION_PREVIEW_TARGET_STALE',
            'Generation preview target does not match the current Scene Shot Video Take.',
            { path: ['target'], context: 'Generation preview subject projection' },
            'Regenerate the preview from the current take context.'
          ),
        ],
      }
    );
  }
}

function shotOrderLabel(
  shots: SceneShot[],
  shotIds: string[]
): string | undefined {
  const positions = shotIds
    .map((shotId) => shots.findIndex((shot) => shot.shotId === shotId))
    .filter((index) => index >= 0)
    .map((index) => index + 1);
  if (positions.length !== shotIds.length || positions.length === 0) {
    return undefined;
  }
  if (positions.length === 1) {
    return `Shot ${positions[0]}`;
  }
  const first = positions[0]!;
  const last = positions[positions.length - 1]!;
  const contiguous = positions.every((position, index) => position === first + index);
  return contiguous ? `Shots ${first}-${last}` : `Shots ${positions.join(', ')}`;
}

function meaningfulLabel(value: string | null | undefined, durableId?: string): string | undefined {
  const trimmed = value?.trim();
  if (!trimmed || trimmed === durableId || looksLikeDurableId(trimmed)) {
    return undefined;
  }
  return trimmed;
}

function looksLikeDurableId(value: string): boolean {
  return /^[a-z][a-z0-9]*_[a-z0-9_]+$/.test(value);
}

function optionalLabel<K extends keyof StudioGenerationPreviewSubject>(
  key: K,
  value: StudioGenerationPreviewSubject[K] | undefined
): Pick<StudioGenerationPreviewSubject, K> | Record<string, never> {
  return value ? { [key]: value } as Pick<StudioGenerationPreviewSubject, K> : {};
}

function isPreviewMediaKind(value: string): value is 'image' | 'audio' | 'video' {
  return value === 'image' || value === 'audio' || value === 'video';
}
