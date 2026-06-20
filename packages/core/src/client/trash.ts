import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';

export type TrashActorKind = 'user' | 'agent' | 'system';

export type TrashItemKind =
  | 'asset'
  | 'assetRelationship'
  | 'castVoice'
  | 'inspirationFolder'
  | 'inspirationImage'
  | 'lookbook'
  | 'lookbookImage'
  | 'lookbookSheet'
  | 'sceneDialogueAudioTake'
  | 'sceneShotVideoTake'
  | 'shotVideoTakeInput';

export interface TrashProjectReport {
  id: string;
  name: string;
  projectFolder?: string;
}

export interface TrashOperation {
  id: string;
  commandName: string;
  actorKind: TrashActorKind;
  actorLabel: string | null;
  reason: string | null;
  createdAt: string;
  restoredAt: string | null;
  garbageCollectedAt: string | null;
}

export interface TrashItem {
  id: string;
  operationId: string;
  itemKind: TrashItemKind;
  itemId: string;
  ownerKind: string | null;
  ownerId: string | null;
  title: string;
  originalProjectRelativePath: string | null;
  trashProjectRelativePath: string | null;
  createdAt: string;
  restoredAt: string | null;
  garbageCollectedAt: string | null;
}

export interface TrashListReport {
  valid: true;
  warnings: DiagnosticIssue[];
  project: TrashProjectReport;
  items: TrashItem[];
  resourceKeys: string[];
}

export interface TrashItemReport {
  valid: true;
  warnings: DiagnosticIssue[];
  project: TrashProjectReport;
  item: TrashItem;
  operation: TrashOperation;
  resourceKeys: string[];
}

export interface RecoverableMutationReport {
  valid: true;
  warnings: DiagnosticIssue[];
  project: TrashProjectReport;
  changes: Array<{ type: string; [key: string]: string }>;
  recovery: {
    operationId: string;
    trashItemIds: string[];
    restorable: boolean;
    restoreCommand: {
      name: 'trash.restore';
      trashItemId: string;
    };
  };
  resourceKeys: string[];
}

export interface GarbageCollectionPreview {
  valid: true;
  warnings: DiagnosticIssue[];
  project: TrashProjectReport;
  confirmationToken: string;
  items: TrashItem[];
  files: Array<{
    trashItemId: string;
    originalProjectRelativePath: string;
    trashProjectRelativePath: string;
  }>;
  resourceKeys: string[];
}

export interface GarbageCollectionReport extends GarbageCollectionPreview {
  dryRun: boolean;
  operationId: string;
  manifestProjectRelativePath: string;
}
