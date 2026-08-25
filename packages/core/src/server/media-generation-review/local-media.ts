import fs from 'node:fs';
import path from 'node:path';
import { and, eq, isNull } from 'drizzle-orm';
import { createDiagnosticWarning, type DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type {
  JsonValue,
  MediaGenerationReferenceView,
} from '../../client/media-generation-review.js';
import type { ProjectRelativePath } from '../../client/project/index.js';
import { assetFiles } from '../schema/index.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import type { RenkuConfigPathOptions } from '../config/index.js';
import {
  normalizeProjectRelativePath,
  resolveProjectRelativePath,
} from '../files/project-relative-paths.js';
import { ProjectDataError } from '../project-data-error.js';
import { withProject } from '../project-operation.js';

interface Marker {
  $file: string;
  mimeType?: string;
}

export function projectLocalMediaReferences(input: {
  request: JsonValue;
  session: DatabaseSession;
  projectFolder: string;
  projectName: string;
}): {
  references: MediaGenerationReferenceView[];
  diagnostics: DiagnosticIssue[];
} {
  const diagnostics: DiagnosticIssue[] = [];
  const seen = new Set<string>();
  const references: MediaGenerationReferenceView[] = [];
  for (const marker of findMarkers(input.request)) {
    const projectRelativePath = normalizeReferencePath(marker.$file);
    if (seen.has(projectRelativePath)) {
      continue;
    }
    seen.add(projectRelativePath);
    const record = input.session.db
      .select({ mimeType: assetFiles.mimeType, mediaKind: assetFiles.mediaKind })
      .from(assetFiles)
      .where(and(
        eq(assetFiles.projectRelativePath, projectRelativePath),
        isNull(assetFiles.discardedAt),
      ))
      .get();
    const absolutePath = resolveProjectRelativePath(input.projectFolder, projectRelativePath);
    const available = Boolean(record && fs.existsSync(absolutePath));
    const kind = mediaKind(record?.mediaKind, record?.mimeType ?? marker.mimeType, projectRelativePath);
    if (!kind) {
      throw new ProjectDataError(
        'CORE_MEDIA_GENERATION_LOCAL_MEDIA_UNSUPPORTED',
        `Local media type is unsupported: ${projectRelativePath}.`,
      );
    }
    if (!available) {
      diagnostics.push(createDiagnosticWarning(
        'CORE_MEDIA_GENERATION_LOCAL_MEDIA_NOT_FOUND',
        `Referenced media is unavailable: ${projectRelativePath}.`,
        { path: ['request', projectRelativePath] },
        'Choose another reference if the original file was discarded.',
      ));
    }
    references.push({
      kind,
      projectRelativePath,
      available,
      ...(available ? {
        browserUrl: `/studio-api/projects/${encodeURIComponent(input.projectName)}/generation-reference-file?path=${encodeURIComponent(projectRelativePath)}`,
      } : {}),
    });
  }
  return { references, diagnostics };
}

export function replaceLocalMediaPaths(
  value: JsonValue,
  resolve: (projectRelativePath: ProjectRelativePath) => string,
): JsonValue {
  if (isMarker(value)) {
    const projectRelativePath = normalizeReferencePath(value.$file);
    return {
      $file: resolve(projectRelativePath),
      ...(value.mimeType ? { mimeType: value.mimeType } : {}),
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
  input: RenkuConfigPathOptions & { projectName?: string; projectRelativePath: string },
): Promise<{ absolutePath: string; mimeType: string }> {
  return withProject(input, ({ session, projectFolder }) => {
    const projectRelativePath = normalizeReferencePath(input.projectRelativePath);
    const record = session.db
      .select({ mimeType: assetFiles.mimeType })
      .from(assetFiles)
      .where(and(
        eq(assetFiles.projectRelativePath, projectRelativePath),
        isNull(assetFiles.discardedAt),
      ))
      .get();
    const absolutePath = resolveProjectRelativePath(projectFolder, projectRelativePath);
    if (!record || !fs.existsSync(absolutePath)) {
      throw new ProjectDataError(
        'CORE_MEDIA_GENERATION_LOCAL_MEDIA_NOT_FOUND',
        `Referenced media is unavailable: ${projectRelativePath}.`,
      );
    }
    const kind = mediaKind(undefined, record.mimeType ?? undefined, projectRelativePath);
    if (!kind) {
      throw new ProjectDataError(
        'CORE_MEDIA_GENERATION_LOCAL_MEDIA_UNSUPPORTED',
        `Local media type is unsupported: ${projectRelativePath}.`,
      );
    }
    return {
      absolutePath,
      mimeType: record.mimeType ?? `${kind}/octet-stream`,
    };
  });
}

function findMarkers(value: JsonValue): Marker[] {
  const result: Marker[] = [];
  visit(value, (marker) => result.push(marker));
  return result;
}

function visit(value: JsonValue, onMarker: (marker: Marker) => void): void {
  if (isMarker(value)) {
    onMarker(value);
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((entry) => visit(entry, onMarker));
    return;
  }
  if (value !== null && typeof value === 'object') {
    Object.values(value).forEach((entry) => visit(entry, onMarker));
  }
}

function isMarker(value: unknown): value is Marker {
  if (value === null || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const record = value as Record<string, unknown>;
  const keys = Object.keys(record);
  return keys.every((key) => key === '$file' || key === 'mimeType')
    && typeof record.$file === 'string'
    && record.$file.length > 0
    && (record.mimeType === undefined || typeof record.mimeType === 'string');
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
