import path from 'node:path';
import { createDiagnosticWarning, type DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type {
  MediaGenerationReferenceView,
} from '../../client/media-generation-review.js';
import type { JsonValue } from '../../client/json.js';
import type { ProjectRelativePath } from '../../client/project/index.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import type { RenkuConfigPathOptions } from '../config/index.js';
import {
  normalizeProjectRelativePath,
} from '../files/project-relative-paths.js';
import { ProjectDataError } from '../project-data-error.js';
import { withProject } from '../project-operation.js';
import { readProjectRecord } from '../database/access/project.js';
import { resolveMediaGenerationReferenceFile } from './reference-files.js';

interface Marker {
  $file: string;
  mimeType?: string;
  reviewLabel?: string;
  promptMention?: string;
}

interface MarkerOccurrence {
  marker: Marker;
  requestPointer: string;
}

const MAX_REVIEW_LABEL_LENGTH = 256;
const MAX_PROMPT_MENTION_LENGTH = 128;
const REFERENCE_IMPORT_GUIDANCE = 'Import the file with renku asset-file import before using it as a reference.';

export async function projectLocalMediaReferences(input: {
  request: JsonValue;
  session: DatabaseSession;
  projectFolder: string;
  projectName: string;
}): Promise<{
  references: MediaGenerationReferenceView[];
  diagnostics: DiagnosticIssue[];
}> {
  const diagnostics: DiagnosticIssue[] = [];
  const references: MediaGenerationReferenceView[] = [];
  const mentions = new Set<string>();
  for (const { marker, requestPointer } of findMarkers(input.request)) {
    validateMarkerAnnotations(marker);
    if (marker.promptMention !== undefined) {
      if (mentions.has(marker.promptMention)) {
        throw new ProjectDataError(
          'CORE_MEDIA_GENERATION_REFERENCE_MENTION_DUPLICATE',
          `Media generation prompt mention is used more than once: ${marker.promptMention}.`,
        );
      }
      mentions.add(marker.promptMention);
    }
    const projectRelativePath = normalizeReferencePath(marker.$file);
    const resolution = await resolveMediaGenerationReferenceFile({ ...input, projectRelativePath });
    const file = resolution.status === 'available' ? resolution : null;
    const available = file !== null;
    const kind = mediaKind(file?.mediaKind, file?.mimeType ?? marker.mimeType, projectRelativePath);
    if (!kind) {
      throw new ProjectDataError(
        'CORE_MEDIA_GENERATION_LOCAL_MEDIA_UNSUPPORTED',
        `Local media type is unsupported: ${projectRelativePath}.`,
      );
    }
    if (!available) {
      diagnostics.push(createDiagnosticWarning(
        resolution.status === 'untracked'
          ? 'PROJECT_ASSET_FILE_REFERENCE_NOT_TRACKED'
          : 'CORE_MEDIA_GENERATION_LOCAL_MEDIA_NOT_FOUND',
        resolution.status === 'untracked'
          ? `Referenced file has not been imported: ${projectRelativePath}.`
          : `Referenced media is unavailable: ${projectRelativePath}.`,
        { path: ['request', projectRelativePath] },
        resolution.status === 'untracked'
          ? REFERENCE_IMPORT_GUIDANCE
          : 'Choose an available AssetFile, or restore the referenced file.',
      ));
    }
    references.push({
      requestPointer,
      kind,
      projectRelativePath,
      reviewLabel: marker.reviewLabel,
      ...(marker.promptMention === undefined ? {} : { promptMention: marker.promptMention }),
      available,
      ...(available ? {
        browserUrl: `/studio-api/projects/${encodeURIComponent(input.projectName)}/generation-reference-file?path=${encodeURIComponent(projectRelativePath)}`,
      } : {}),
    });
  }
  return { references, diagnostics };
}

export function validateMediaGenerationReferenceMarkers(request: JsonValue): void {
  const mentions = new Set<string>();
  for (const { marker } of findMarkers(request)) {
    validateMarkerAnnotations(marker);
    if (marker.promptMention !== undefined) {
      if (mentions.has(marker.promptMention)) {
        throw new ProjectDataError(
          'CORE_MEDIA_GENERATION_REFERENCE_MENTION_DUPLICATE',
          `Media generation prompt mention is used more than once: ${marker.promptMention}.`,
        );
      }
      mentions.add(marker.promptMention);
    }
  }
}

export function mediaGenerationReferenceProjectPaths(
  request: JsonValue,
): ProjectRelativePath[] {
  return findMarkers(request).map(({ marker }) => normalizeReferencePath(marker.$file));
}

export function replaceLocalMediaPaths(
  value: JsonValue,
  resolve: (projectRelativePath: ProjectRelativePath) => string,
): JsonValue {
  if (isMarker(value)) {
    validateMarkerAnnotations(value);
    const projectRelativePath = normalizeReferencePath(value.$file);
    return {
      $file: resolve(projectRelativePath),
      ...(value.mimeType ? { mimeType: value.mimeType } : {}),
      reviewLabel: value.reviewLabel,
      ...(value.promptMention === undefined ? {} : { promptMention: value.promptMention }),
    };
  }
  if (Array.isArray(value)) {
    return value.map((entry) => replaceLocalMediaPaths(entry, resolve));
  }
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value).map(([key, entry]) => [key, replaceLocalMediaPaths(entry, resolve)]),
    );
  }
  return value;
}

export async function readMediaGenerationReferenceProjectFile(
  input: RenkuConfigPathOptions & { projectName?: string; projectRelativePath: string; expectedProjectId?: string },
): Promise<{ absolutePath: string; mimeType: string }> {
  return withProject(input, async ({ session, projectFolder }) => {
    if (input.expectedProjectId !== undefined && readProjectRecord(session)?.id !== input.expectedProjectId) {
      throw new ProjectDataError('CORE_MEDIA_GENERATION_LOCAL_MEDIA_NOT_FOUND', 'The referenced Project is no longer available.');
    }
    const projectRelativePath = normalizeReferencePath(input.projectRelativePath);
    const file = await resolveMediaGenerationReferenceFile({ session, projectFolder, projectRelativePath });
    if (file.status === 'untracked') {
      throw new ProjectDataError(
        'PROJECT_ASSET_FILE_REFERENCE_NOT_TRACKED',
        `Referenced file has not been imported: ${projectRelativePath}.`,
        { suggestion: REFERENCE_IMPORT_GUIDANCE },
      );
    }
    if (file.status !== 'available') {
      throw new ProjectDataError(
        'CORE_MEDIA_GENERATION_LOCAL_MEDIA_NOT_FOUND',
        `Referenced media is unavailable: ${projectRelativePath}.`,
      );
    }
    const kind = mediaKind(file.mediaKind, file.mimeType, projectRelativePath);
    if (!kind) {
      throw new ProjectDataError(
        'CORE_MEDIA_GENERATION_LOCAL_MEDIA_UNSUPPORTED',
        `Local media type is unsupported: ${projectRelativePath}.`,
      );
    }
    return {
      absolutePath: file.absolutePath,
      mimeType: file.mimeType ?? `${kind}/octet-stream`,
    };
  });
}

function findMarkers(value: JsonValue): MarkerOccurrence[] {
  const result: MarkerOccurrence[] = [];
  visit(value, '', (marker, requestPointer) => result.push({ marker, requestPointer }));
  return result;
}

function visit(
  value: JsonValue,
  requestPointer: string,
  onMarker: (marker: Marker, requestPointer: string) => void,
): void {
  if (isMarker(value)) {
    onMarker(value, requestPointer);
    return;
  }
  if (hasReservedFileField(value)) {
    throw new ProjectDataError(
      'CORE_MEDIA_GENERATION_REFERENCE_MARKER_INVALID',
      `Local media marker is invalid at request${requestPointer || '/'}.`,
    );
  }
  if (Array.isArray(value)) {
    value.forEach((entry, index) => visit(entry, `${requestPointer}/${index}`, onMarker));
    return;
  }
  if (value !== null && typeof value === 'object') {
    Object.entries(value).forEach(([key, entry]) => {
      visit(entry, `${requestPointer}/${escapeJsonPointer(key)}`, onMarker);
    });
  }
}

function hasReservedFileField(value: unknown): boolean {
  return value !== null
    && typeof value === 'object'
    && !Array.isArray(value)
    && Object.prototype.hasOwnProperty.call(value, '$file');
}

function isMarker(value: unknown): value is Marker {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  return keys.every((key) => (
    key === '$file'
    || key === 'mimeType'
    || key === 'reviewLabel'
    || key === 'promptMention'
  ))
    && typeof record.$file === 'string'
    && record.$file.length > 0
    && (record.mimeType === undefined || typeof record.mimeType === 'string')
    && (record.reviewLabel === undefined || typeof record.reviewLabel === 'string')
    && (record.promptMention === undefined || typeof record.promptMention === 'string');
}

function validateMarkerAnnotations(
  marker: Marker,
): asserts marker is Marker & { reviewLabel: string } {
  if (!isBoundedDisplayString(marker.reviewLabel, MAX_REVIEW_LABEL_LENGTH)) {
    throw new ProjectDataError(
      'CORE_MEDIA_GENERATION_REFERENCE_LABEL_INVALID',
      'Every local media reference must have a non-empty reviewLabel without control characters.',
    );
  }
  if (marker.promptMention !== undefined
    && !isBoundedDisplayString(marker.promptMention, MAX_PROMPT_MENTION_LENGTH)) {
    throw new ProjectDataError(
      'CORE_MEDIA_GENERATION_REFERENCE_MENTION_INVALID',
      'A promptMention must be a non-empty bounded string without control characters.',
    );
  }
}

function isBoundedDisplayString(value: unknown, maximumLength: number): value is string {
  return typeof value === 'string'
    && value.trim().length > 0
    && value.length <= maximumLength
    && !containsControlCharacter(value);
}

function containsControlCharacter(value: string): boolean {
  return Array.from(value).some((character) => {
    const code = character.charCodeAt(0);
    return code <= 31 || (code >= 127 && code <= 159);
  });
}

function escapeJsonPointer(value: string): string {
  return value.replaceAll('~', '~0').replaceAll('/', '~1');
}

function normalizeReferencePath(value: string): ProjectRelativePath {
  let normalized: ProjectRelativePath;
  try {
    normalized = normalizeProjectRelativePath(value);
  } catch (error) {
    throw new ProjectDataError(
      path.isAbsolute(value)
        ? 'CORE_MEDIA_GENERATION_LOCAL_MEDIA_OUTSIDE_PROJECT'
        : 'CORE_MEDIA_GENERATION_REVIEW_UNSAFE',
      `Local media path is not a safe Project-relative path: ${value}.`,
      { suggestion: error instanceof Error ? error.message : undefined },
    );
  }
  return normalized;
}

function mediaKind(
  storedKind: string | undefined,
  mimeType: string | undefined,
  filePath: string,
): 'image' | 'video' | 'audio' | null {
  if (storedKind === 'image' || storedKind === 'video' || storedKind === 'audio') {
    return storedKind;
  }
  const type = mimeType?.split('/')[0];
  if (type === 'image' || type === 'video' || type === 'audio') {
    return type;
  }
  const extension = path.extname(filePath).toLowerCase();
  if (['.png', '.jpg', '.jpeg', '.webp', '.gif', '.avif'].includes(extension)) {
    return 'image';
  }
  if (['.mp4', '.webm', '.mov', '.m4v'].includes(extension)) {
    return 'video';
  }
  if (['.mp3', '.wav', '.m4a', '.ogg', '.flac'].includes(extension)) {
    return 'audio';
  }
  return null;
}
