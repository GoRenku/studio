import { createProjectDataService } from '@gorenku/studio-core/server';
import type { CastCastingResource } from '@gorenku/studio-core/client';
import type { CastingSheetBoard } from './contracts.js';
import type { CastingBoardSessionRecord, CastingBoardSubject } from './session-state.js';

type SheetSubject = Extract<CastingBoardSubject, { mode: 'sheets' }>;

/** Re-reads Core so polling shows sheets as the agent imports them and picks made in Studio. */
export async function projectSheetBoard(record: CastingBoardSessionRecord, subject: SheetSubject, homeDir?: string): Promise<CastingSheetBoard> {
  const resource = await readSheetBoardResource(record, subject, homeDir);
  return structuredClone({
    mode: 'sheets' as const,
    sessionId: record.sessionId,
    revision: record.revision,
    castMember: resource.castMember,
    scenes: resource.scenes,
    looks: resource.looks.map((look) => ({
      id: look.id,
      name: look.name,
      castImageUri: look.castCandidate ? record.media.uri(look.castCandidate.projectRelativePath) : null,
    })),
    costumes: resource.costumes.map((costume) => ({
      id: costume.id,
      name: costume.name,
      lookId: costume.lookId,
      sceneIds: costume.sceneIds,
      pickedAssetFileId: costume.characterSheetAssetFileId,
    })),
    sheets: resource.characterSheets.map((sheet) => ({ assetFileId: sheet.id, imageUri: record.media.uri(sheet.projectRelativePath) })),
    action: record.action,
    lastCompletedAction: record.lastCompletedAction,
  });
}

export function readSheetBoardResource(record: CastingBoardSessionRecord, subject: SheetSubject, homeDir?: string): Promise<CastCastingResource> {
  return createProjectDataService().readCastCastingResource({ projectName: record.projectRef.name, homeDir, castMemberId: subject.castMemberId });
}
