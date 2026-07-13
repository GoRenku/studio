import Database from 'better-sqlite3';
import { existsSync } from 'node:fs';
import {
  createDiagnosticError,
  type DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import { ProjectDataError } from '../../project-data-error.js';

interface LegacyReferenceSelections {
  selectedCharacterSheetAssetIds?: Record<string, string>;
  selectedLocationSheetAssetIds?: Record<string, string>;
  selectedLookbookSheetIds?: string[];
  selectedDialogueAudioTakeIds?: Record<string, string>;
}

export function assertContextFirstGenerationMigrationReady(
  databasePath: string
): void {
  if (!existsSync(databasePath)) {
    return;
  }
  const sqlite = new Database(databasePath, {
    readonly: true,
    fileMustExist: true,
  });
  try {
    if (!hasLegacyGenerationSchema(sqlite)) {
      return;
    }
    const issues = [
      ...validateMediaInputs(sqlite, databasePath),
      ...validateTakeSelections(sqlite, databasePath),
    ];
    if (issues.length > 0) {
      throw new ProjectDataError(
        'CORE_GENERATION_MIGRATION_INVALID',
        'Context-first generation migration cannot preserve every explicit Shot reference unambiguously.',
        {
          issues,
          suggestion:
            'Repair the reported exact asset/file relationships before applying the migration. Renku will not select replacements or drop ambiguous references.',
        }
      );
    }
  } finally {
    sqlite.close();
  }
}

function hasLegacyGenerationSchema(sqlite: Database.Database): boolean {
  const columns = sqlite
    .prepare('pragma table_info(media_generation_spec)')
    .all() as Array<{ name?: unknown }>;
  return columns.some((column) => column.name === 'spec_json');
}

function validateMediaInputs(
  sqlite: Database.Database,
  databasePath: string
): DiagnosticIssue[] {
  const rows = sqlite.prepare(`
    select input.id,
      input.input_kind as inputKind,
      input.asset_id as assetId,
      input.asset_file_id as assetFileId,
      asset.id as resolvedAssetId,
      file.id as resolvedFileId
    from scene_shot_video_take_media_input input
    left join asset
      on asset.id = input.asset_id and asset.discarded_at is null
    left join asset_file file
      on file.id = input.asset_file_id
      and file.asset_id = input.asset_id
      and file.discarded_at is null
    where input.discarded_at is null
  `).all() as Array<{
    id: string;
    inputKind: string;
    assetId: string;
    assetFileId: string;
    resolvedAssetId: string | null;
    resolvedFileId: string | null;
  }>;
  return rows.flatMap((row) => {
    if (
      !['first-frame', 'last-frame', 'video-prompt-sheet', 'reference-image']
        .includes(row.inputKind)
    ) {
      return [migrationIssue({
        databasePath,
        path: ['sceneShotVideoTakeMediaInput', row.id, 'inputKind'],
        message: `Shot media input ${row.id} has unsupported migration kind ${row.inputKind}.`,
      })];
    }
    if (row.resolvedAssetId && row.resolvedFileId) {
      return [];
    }
    return [migrationIssue({
      databasePath,
      path: ['sceneShotVideoTakeMediaInput', row.id, 'reference'],
      message: `Shot media input ${row.id} does not resolve to its exact active asset/file pair ${row.assetId}/${row.assetFileId}.`,
    })];
  });
}

function validateTakeSelections(
  sqlite: Database.Database,
  databasePath: string
): DiagnosticIssue[] {
  const takes = sqlite.prepare(`
    select id, state_json as stateJson
    from scene_shot_video_take
  `).all() as Array<{ id: string; stateJson: string }>;
  const issues: DiagnosticIssue[] = [];
  for (const take of takes) {
    let state: unknown;
    try {
      state = JSON.parse(take.stateJson);
    } catch {
      issues.push(migrationIssue({
        databasePath,
        path: ['sceneShotVideoTake', take.id, 'state'],
        message: `Shot Video Take ${take.id} has invalid JSON state.`,
      }));
      continue;
    }
    for (const direction of legacyDirections(state)) {
      const location = [
        'sceneShotVideoTake',
        take.id,
        direction.scopeId ?? 'shared',
        'referenceSelections',
      ];
      for (const [castMemberId, assetId] of Object.entries(
        direction.selections.selectedCharacterSheetAssetIds ?? {}
      )) {
        validateSingleAssetFile(sqlite, issues, {
          databasePath,
          path: [...location, 'selectedCharacterSheetAssetIds', castMemberId],
          assetId,
        });
      }
      for (const [locationId, assetId] of Object.entries(
        direction.selections.selectedLocationSheetAssetIds ?? {}
      )) {
        validateSingleAssetFile(sqlite, issues, {
          databasePath,
          path: [...location, 'selectedLocationSheetAssetIds', locationId],
          assetId,
        });
      }
      for (const [index, sheetId] of (
        direction.selections.selectedLookbookSheetIds ?? []
      ).entries()) {
        const sheet = sqlite.prepare(`
          select asset_id as assetId
          from lookbook_sheet
          where id = ? and discarded_at is null
        `).get(sheetId) as { assetId: string } | undefined;
        if (!sheet) {
          issues.push(migrationIssue({
            databasePath,
            path: [...location, 'selectedLookbookSheetIds', String(index)],
            message: `Selected Lookbook Sheet ${sheetId} is unavailable.`,
          }));
        } else {
          validateSingleAssetFile(sqlite, issues, {
            databasePath,
            path: [...location, 'selectedLookbookSheetIds', String(index)],
            assetId: sheet.assetId,
          });
        }
      }
      for (const [dialogueId, audioTakeId] of Object.entries(
        direction.selections.selectedDialogueAudioTakeIds ?? {}
      )) {
        const exact = sqlite.prepare(`
          select 1
          from scene_dialogue_audio_take audio_take
          join asset
            on asset.id = audio_take.asset_id and asset.discarded_at is null
          join asset_file file
            on file.id = audio_take.asset_file_id
            and file.asset_id = audio_take.asset_id
            and file.discarded_at is null
          where audio_take.id = ? and audio_take.discarded_at is null
        `).get(audioTakeId);
        if (!exact) {
          issues.push(migrationIssue({
            databasePath,
            path: [...location, 'selectedDialogueAudioTakeIds', dialogueId],
            message: `Selected dialogue audio take ${audioTakeId} does not resolve to an exact active asset file.`,
          }));
        }
      }
    }
  }
  return issues;
}

function validateSingleAssetFile(
  sqlite: Database.Database,
  issues: DiagnosticIssue[],
  input: { databasePath: string; path: string[]; assetId: string }
): void {
  const row = sqlite.prepare(`
    select count(*) as fileCount
    from asset_file file
    join asset on asset.id = file.asset_id and asset.discarded_at is null
    where file.asset_id = ? and file.discarded_at is null
  `).get(input.assetId) as { fileCount: number };
  if (row.fileCount !== 1) {
    issues.push(migrationIssue({
      databasePath: input.databasePath,
      path: input.path,
      message: `Selected asset ${input.assetId} has ${row.fileCount} active files; exactly one is required for unambiguous migration.`,
    }));
  }
}

function legacyDirections(state: unknown): Array<{
  scopeId: string | null;
  selections: LegacyReferenceSelections;
}> {
  if (!isRecord(state) || !isRecord(state.structure)) {
    return [];
  }
  const directions: Array<{
    scopeId: string | null;
    selections: LegacyReferenceSelections;
  }> = [];
  const sharedDirection = state.structure.sharedDirection;
  if (isRecord(sharedDirection) && isRecord(sharedDirection.referenceSelections)) {
    directions.push({
      scopeId: null,
      selections: sharedDirection.referenceSelections as LegacyReferenceSelections,
    });
  }
  const directionsByShotId = state.structure.directionsByShotId;
  if (isRecord(directionsByShotId)) {
    for (const [shotId, direction] of Object.entries(directionsByShotId)) {
      if (isRecord(direction) && isRecord(direction.referenceSelections)) {
        directions.push({
          scopeId: shotId,
          selections: direction.referenceSelections as LegacyReferenceSelections,
        });
      }
    }
  }
  return directions;
}

function migrationIssue(input: {
  databasePath: string;
  path: string[];
  message: string;
}): DiagnosticIssue {
  return createDiagnosticError(
    'CORE_GENERATION_MIGRATION_AMBIGUOUS_REFERENCE',
    input.message,
    { filePath: input.databasePath, path: input.path },
    'Repair or remove this exact selection before retrying the migration.'
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value && typeof value === 'object' && !Array.isArray(value));
}
