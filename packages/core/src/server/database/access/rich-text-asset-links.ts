import { and, eq } from 'drizzle-orm';
import { assetFiles } from '../../schema/index.js';
import type { AssetTarget, RichTextAssetLink } from '../../../client/index.js';
import { ProjectDataError } from '../../project-data-error.js';
import { normalizeProjectRelativePath } from '../../files/project-relative-paths.js';
import type { DatabaseSession } from '../lifecycle/store.js';
import {
  assetRelationshipTableConfig,
  assertAssetTargetExists,
} from './asset-relationships/targets.js';

export function readRichTextAssetLink(
  session: DatabaseSession,
  input: {
    target: AssetTarget;
    role: string;
    relationshipLabel: string;
    richTextRoles: ReadonlySet<string>;
  }
): RichTextAssetLink | undefined {
  const config = assetRelationshipTableConfig(input.target);
  assertAssetTargetExists(session, config);
  const table = config.table as any;
  const conditions = [eq(table.role, input.role)];
  if (config.targetColumn && config.targetId) {
    conditions.push(eq(config.targetColumn, config.targetId));
  }
  const relationship = session.db
    .select({
      relationshipId: table.id,
      assetId: table.assetId,
      role: table.role,
      localeId: table.localeId,
    })
    .from(table)
    .where(and(...conditions))
    .orderBy(table.sortOrder)
    .limit(1)
    .get();
  if (!relationship) {
    return undefined;
  }

  const file = session.db
    .select({
      id: assetFiles.id,
      mediaKind: assetFiles.mediaKind,
      projectRelativePath: assetFiles.projectRelativePath,
    })
    .from(assetFiles)
    .where(
      and(
        eq(assetFiles.assetId, relationship.assetId),
        eq(assetFiles.role, 'primary')
      )
    )
    .get();
  if (!file) {
    throw new ProjectDataError(
      'PROJECT_DATA061',
      `Text asset ${relationship.assetId} is missing its primary asset file.`
    );
  }
  if (file.mediaKind !== 'text' && file.mediaKind !== 'markdown') {
    if (input.richTextRoles.has(relationship.role)) {
      throw new ProjectDataError(
        'PROJECT_DATA091',
        `${input.relationshipLabel} asset relationship ${relationship.relationshipId} uses rich text role ${relationship.role} with non-text primary asset file ${file.id}.`,
        {
          suggestion:
            'Attach a text or markdown primary file for rich text roles, or use a non-rich-text relationship role for image, audio, and video assets.',
        }
      );
    }
    return undefined;
  }

  return {
    assetId: relationship.assetId,
    assetFileId: file.id,
    role: relationship.role,
    localeId: relationship.localeId ?? undefined,
    projectRelativePath: normalizeProjectRelativePath(file.projectRelativePath),
  };
}

export function projectSummaryRichTextRole(): ReadonlySet<string> {
  return new Set(['summary']);
}

export function clipRichTextRoles(): ReadonlySet<string> {
  return new Set(['summary', 'visual_intent']);
}

export function castMemberRichTextRoles(): ReadonlySet<string> {
  return new Set(['description']);
}
