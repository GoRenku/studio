import path from 'node:path';
import type {
  ProductionExportVariant,
  ProjectRelativePath,
} from '../../client/index.js';
import type { ProductionExportMediaRow } from '../database/access/production-export.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { joinProjectRelativePath } from '../files/project-relative-paths.js';

export function allocateProductionAssetPath(
  _session: DatabaseSession,
  row: ProductionExportMediaRow,
  _variant: ProductionExportVariant,
  rootProjectRelativePath: ProjectRelativePath
): ProjectRelativePath {
  return joinProjectRelativePath(
    rootProjectRelativePath,
    'sequences',
    numberedSlug(row.sequencePosition, row.sequenceTitle),
    'scenes',
    numberedSlug(row.scenePosition, row.sceneTitle),
    'takes',
    slugify(row.takeTitle),
    exportFileName(row)
  );
}

function exportFileName(row: ProductionExportMediaRow): string {
  const extension = path.posix.extname(row.sourceProjectRelativePath);
  return row.role === 'shot-video'
    ? `video${extension}`
    : `${slugify(row.dialogueId ?? 'dialogue')}${extension}`;
}

function numberedSlug(position: number, title: string): string {
  return `${String(position + 1).padStart(2, '0')}-${slugify(title)}`;
}

function slugify(input: string): string {
  return input.trim().toLowerCase().replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '') || 'untitled';
}
