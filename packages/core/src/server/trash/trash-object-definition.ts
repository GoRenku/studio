import type {
  DiagnosticIssue,
} from '@gorenku/studio-diagnostics';
import type {
  RecoverableMutationReport,
  TrashItem,
  TrashItemKind,
} from '../../client/index.js';
import type { ProjectRecord } from '../database/access/project.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';

export interface TrashProjectContext {
  project: Pick<ProjectRecord, 'id' | 'name'>;
  projectFolder: string;
}

export interface TrashItemDraft {
  itemKind: TrashItemKind;
  itemId: string;
  ownerKind?: string | null;
  ownerId?: string | null;
  title: string;
  originalProjectRelativePath?: string | null;
  restoreSnapshot: Record<string, unknown>;
}

export interface TrashObjectDiscardContext extends TrashProjectContext {
  session: DatabaseSession;
  itemId: string;
  operationId: string;
  now: string;
}

export interface TrashObjectRestoreContext extends TrashProjectContext {
  session: DatabaseSession;
  trashItem: TrashItem;
  snapshot: Record<string, unknown>;
  now: string;
}

export interface TrashObjectGarbageCollectionContext extends TrashProjectContext {
  session: DatabaseSession;
  trashItem: TrashItem;
  snapshot: Record<string, unknown>;
}

export interface TrashObjectResourceKeyContext {
  itemId: string;
  ownerKind?: string | null;
  ownerId?: string | null;
}

export interface TrashFileDraft {
  trashItemId: string;
  originalProjectRelativePath: string;
}

export interface TrashObjectDefinition {
  itemKind: TrashItemKind;
  readTrashItems(input: TrashObjectDiscardContext): TrashItemDraft[];
  applyDiscard(input: TrashObjectDiscardContext): void;
  applyRestore(input: TrashObjectRestoreContext): DiagnosticIssue[] | void;
  collectFiles(input: TrashObjectGarbageCollectionContext): TrashFileDraft[];
  resourceKeys(input: TrashObjectResourceKeyContext): string[];
  restoredChanges(input: { itemId: string }): RecoverableMutationReport['changes'];
}
