import type {
  MediaGenerationPurpose,
  MediaGenerationSpecRecord,
  MediaKind,
  ProjectRelativePath,
} from '../../../client/index.js';
import type { DatabaseSession } from '../../database/lifecycle/store.js';
import { joinProjectRelativePath } from '../../files/project-relative-paths.js';
import { ProjectDataError } from '../../project-data-error.js';
import type {
  ProjectAssetFileDestination,
  ProjectTemporaryFileDestination,
} from '../types.js';

export interface GenerationOutputResolverInput<
  P extends MediaGenerationPurpose = MediaGenerationPurpose,
> {
  session: DatabaseSession;
  projectFolder: string;
  specRecord: MediaGenerationSpecRecord & { purpose: P };
  outputCount: number;
}

export type GenerationOutputAllocation =
  | {
      kind: 'temporary';
      destination: ProjectTemporaryFileDestination;
      outputNames: string[];
    }
  | {
      kind: 'durableAsset';
      destination: ProjectAssetFileDestination;
      sourceProjectRelativePath: ProjectRelativePath;
      mediaKind: MediaKind;
      outputFormatHint?: string;
    };

export type GenerationOutputResolver<P extends MediaGenerationPurpose> = (
  input: GenerationOutputResolverInput<P>
) => Promise<GenerationOutputAllocation>;

export type GenerationOutputResolverRegistry = {
  [P in MediaGenerationPurpose]: GenerationOutputResolver<P>;
};

export function specObject(
  specRecord: MediaGenerationSpecRecord
): Record<string, unknown> {
  return specRecord.spec as unknown as Record<string, unknown>;
}

export function targetId(spec: Record<string, unknown>): string {
  const target = spec.target as { id?: unknown } | undefined;
  if (!target || typeof target.id !== 'string' || !target.id.trim()) {
    throw new ProjectDataError(
      'PROJECT_ASSET_FILE_TARGET_REQUIRED',
      'Media generation asset-file placement requires a spec target id.'
    );
  }
  return target.id;
}

export function requiredSpecString(
  spec: Record<string, unknown>,
  fieldName: string
): string {
  const value = spec[fieldName];
  if (typeof value !== 'string' || !value.trim()) {
    throw new ProjectDataError(
      'PROJECT_ASSET_FILE_SPEC_FIELD_REQUIRED',
      `Media generation asset-file placement requires spec.${fieldName}.`
    );
  }
  return value.trim();
}

export function temporaryOutputNames(input: {
  purpose: MediaGenerationPurpose;
  outputCount: number;
  extension: string;
}): string[] {
  const baseName = input.purpose.replaceAll('.', '-');
  return Array.from({ length: Math.max(1, input.outputCount) }, (_, index) =>
    input.outputCount === 1
      ? `${baseName}${input.extension}`
      : `${baseName}-${String(index + 1).padStart(2, '0')}${input.extension}`
  );
}

export function sourceProjectRelativePathForMediaKind(
  mediaKind: MediaKind
): ProjectRelativePath {
  return joinProjectRelativePath(
    'tmp',
    `source${mediaKind === 'audio' ? '.mp3' : mediaKind === 'video' ? '.mp4' : '.png'}`
  );
}
