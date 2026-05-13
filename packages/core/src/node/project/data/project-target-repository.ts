import { eq } from 'drizzle-orm';
import type { AnySQLiteColumn, SQLiteTable } from 'drizzle-orm/sqlite-core';
import {
  castAssets,
  castMembers,
  clipAssets,
  clips,
  continuityReferenceAssets,
  continuityReferences,
  projectAssets,
  projectLocales,
  sceneAssets,
  scenes,
  sequenceAssets,
  sequences,
  visualLanguage,
  visualLanguageAssets,
} from '../../../schema/index.js';
import type { AssetTarget } from '../../../project/index.js';
import { ProjectDataError } from '../../../project/index.js';
import type { EntityIdPrefix } from '../ids/project-id-generator.js';
import type { ProjectDataSession } from './sqlite-project-store.js';

export interface AssetRelationshipTableConfig {
  target: AssetTarget;
  table: SQLiteTable;
  idPrefix: EntityIdPrefix;
  targetValueKey: string | null;
  targetColumn: AnySQLiteColumn | null;
  targetId: string | null;
  targetEntityTable: SQLiteTable | null;
  targetEntityIdColumn: AnySQLiteColumn | null;
}

export function assetRelationshipTableConfig(
  target: AssetTarget
): AssetRelationshipTableConfig {
  switch (target.kind) {
    case 'project':
      return {
        target,
        table: projectAssets,
        idPrefix: 'project_asset',
        targetValueKey: null,
        targetColumn: null,
        targetId: null,
        targetEntityTable: null,
        targetEntityIdColumn: null,
      };
    case 'visualLanguage':
      return {
        target,
        table: visualLanguageAssets,
        idPrefix: 'visual_language_asset',
        targetValueKey: 'visualLanguageId',
        targetColumn: visualLanguageAssets.visualLanguageId,
        targetId: target.visualLanguageId,
        targetEntityTable: visualLanguage,
        targetEntityIdColumn: visualLanguage.id,
      };
    case 'castMember':
      return {
        target,
        table: castAssets,
        idPrefix: 'cast_asset',
        targetValueKey: 'castMemberId',
        targetColumn: castAssets.castMemberId,
        targetId: target.castMemberId,
        targetEntityTable: castMembers,
        targetEntityIdColumn: castMembers.id,
      };
    case 'continuityReference':
      return {
        target,
        table: continuityReferenceAssets,
        idPrefix: 'continuity_reference_asset',
        targetValueKey: 'continuityReferenceId',
        targetColumn: continuityReferenceAssets.continuityReferenceId,
        targetId: target.continuityReferenceId,
        targetEntityTable: continuityReferences,
        targetEntityIdColumn: continuityReferences.id,
      };
    case 'sequence':
      return {
        target,
        table: sequenceAssets,
        idPrefix: 'sequence_asset',
        targetValueKey: 'sequenceId',
        targetColumn: sequenceAssets.sequenceId,
        targetId: target.sequenceId,
        targetEntityTable: sequences,
        targetEntityIdColumn: sequences.id,
      };
    case 'scene':
      return {
        target,
        table: sceneAssets,
        idPrefix: 'scene_asset',
        targetValueKey: 'sceneId',
        targetColumn: sceneAssets.sceneId,
        targetId: target.sceneId,
        targetEntityTable: scenes,
        targetEntityIdColumn: scenes.id,
      };
    case 'clip':
      return {
        target,
        table: clipAssets,
        idPrefix: 'clip_asset',
        targetValueKey: 'clipId',
        targetColumn: clipAssets.clipId,
        targetId: target.clipId,
        targetEntityTable: clips,
        targetEntityIdColumn: clips.id,
      };
  }
}

export function assertAssetTargetExists(
  session: ProjectDataSession,
  config: AssetRelationshipTableConfig
): void {
  if (!config.targetEntityTable || !config.targetEntityIdColumn || !config.targetId) {
    return;
  }
  const row = session.db
    .select({ id: config.targetEntityIdColumn })
    .from(config.targetEntityTable)
    .where(eq(config.targetEntityIdColumn, config.targetId))
    .get();
  if (!row) {
    throw new ProjectDataError(
      'PROJECT_DATA085',
      `Asset target was not found: ${config.targetId}.`
    );
  }
}

export function assertProjectLocaleExists(
  session: ProjectDataSession,
  localeId: string | null | undefined
): void {
  if (localeId === undefined || localeId === null) {
    return;
  }
  const row = session.db
    .select({ id: projectLocales.id })
    .from(projectLocales)
    .where(eq(projectLocales.id, localeId))
    .get();
  if (!row) {
    throw new ProjectDataError(
      'PROJECT_DATA086',
      `Project locale was not found: ${localeId}.`
    );
  }
}
