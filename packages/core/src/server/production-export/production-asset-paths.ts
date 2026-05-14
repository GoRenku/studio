import path from 'node:path';
import type {
  ProductionExportVariant,
  ProjectRelativePath,
} from '../../client/index.js';
import type { SelectedProductionAssetRow } from '../database/access/production-export.js';
import {
  readClipProductionHierarchy,
  readSceneProductionHierarchy,
  readSequenceProductionHierarchy,
} from '../database/access/production-export.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { joinProjectRelativePath } from '../files/project-relative-paths.js';
import { ProjectDataError } from '../project-data-error.js';

export function allocateProductionAssetPath(
  session: DatabaseSession,
  row: SelectedProductionAssetRow,
  variant: ProductionExportVariant,
  rootProjectRelativePath: ProjectRelativePath
): ProjectRelativePath {
  if (row.targetKind === 'sequence') {
    const hierarchy = readSequenceProductionHierarchy(session, requiredTargetId(row));
    return joinProjectRelativePath(
      rootProjectRelativePath,
      'sequences',
      numberedSlug(hierarchy.sequencePosition, hierarchy.sequenceTitle),
      exportFileName(row)
    );
  }

  if (row.targetKind === 'scene') {
    const hierarchy = readSceneProductionHierarchy(session, requiredTargetId(row));
    return joinProjectRelativePath(
      rootProjectRelativePath,
      'sequences',
      numberedSlug(hierarchy.sequencePosition, hierarchy.sequenceTitle),
      'scenes',
      numberedSlug(hierarchy.scenePosition, hierarchy.sceneTitle),
      exportFileName(row)
    );
  }

  if (row.targetKind === 'clip') {
    const hierarchy = readClipProductionHierarchy(session, requiredTargetId(row));
    return joinProjectRelativePath(
      rootProjectRelativePath,
      'sequences',
      numberedSlug(hierarchy.sequencePosition, hierarchy.sequenceTitle),
      'scenes',
      numberedSlug(hierarchy.scenePosition, hierarchy.sceneTitle),
      'clips',
      numberedSlug(hierarchy.clipPosition, hierarchy.clipTitle),
      exportFileName(row)
    );
  }

  if (row.targetKind === 'project') {
    return joinProjectRelativePath(
      rootProjectRelativePath,
      'shared',
      sharedFolderName(row.role, variant),
      exportFileName(row)
    );
  }

  throw new ProjectDataError(
    'PROJECT_DATA106',
    `Selected asset target cannot be placed in the production export tree: ${row.targetKind}.`
  );
}

function exportFileName(row: SelectedProductionAssetRow): string {
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
    return 'music';
  }
  if (role === 'sound-effect' || role === 'sound_effect') {
    return 'sound-effects';
  }
  if (role === 'subtitles') {
    return 'subtitles';
  }
  if (
    role === 'final-graphic' ||
    role === 'final_graphic' ||
    role === 'title-card' ||
    role === 'title_card'
  ) {
    return 'graphics';
  }
  if (role === 'locale-video-override' || role === 'locale_video_override') {
    return 'video-overrides';
  }
  return variant.kind === 'localized' ? 'audio' : 'audio';
}

function requiredTargetId(row: SelectedProductionAssetRow): string {
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
