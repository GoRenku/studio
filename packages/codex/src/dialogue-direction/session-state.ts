import { randomUUID } from 'node:crypto';
import type { ShotPlanDialogueAudioTake } from '@gorenku/studio-core/client';
import type { StudioProjectRef } from '@gorenku/studio-core/server';
import type {
  DialogueDirectionAction,
  DialogueDirectionDraft,
  DialogueDirectionLine,
  DialogueDirectionPanel,
  DialogueDirectionRoute,
  DialogueDirectionSession,
  DialogueDirectionVoice,
  DialogueLineRange,
  ElevenV4DirectionInitial,
  SeedAudioDirectionInitial,
} from './contracts.js';
import { directionError } from './diagnostics.js';

export interface DialogueDirectionBinding {
  projectRef: StudioProjectRef;
  shotPlanId: string;
}

/** Panel hook that recovers editable direction from a Take's provenance; null when the panel has none. */
export type TakeActingScriptsReader = (take: ShotPlanDialogueAudioTake, route: DialogueDirectionRoute) => Record<number, string> | null;

export interface DialogueDirectionSessionParts {
  binding: DialogueDirectionBinding;
  panel: DialogueDirectionPanel;
  route: DialogueDirectionRoute;
  shotPlan: { id: string; title: string; sceneHeading: string };
  lines: DialogueDirectionLine[];
  voices: Record<string, DialogueDirectionVoice[]>;
  initial: ElevenV4DirectionInitial | SeedAudioDirectionInitial;
  takeActingScripts: TakeActingScriptsReader | null;
}

export interface DialogueDirectionSessionRecord extends DialogueDirectionSessionParts {
  sessionId: string;
  revision: number;
  action: DialogueDirectionAction | null;
  lastCompletedAction: DialogueDirectionSession['lastCompletedAction'];
  media: DirectionMediaRegistry;
}

interface StoredAction extends DialogueDirectionAction {
  draft: DialogueDirectionDraft;
}

interface StoredSession extends DialogueDirectionSessionParts {
  sessionId: string;
  revision: number;
  action: StoredAction | null;
  lastCompletedAction: DialogueDirectionSession['lastCompletedAction'];
  consumedActionIds: Set<string>;
  media: DirectionMediaRegistry;
}

/** Opaque per-session media ids for project files the panel may read. */
export class DirectionMediaRegistry {
  private readonly paths = new Map<string, string>();
  private readonly ids = new Map<string, string>();

  constructor(private readonly sessionId: string) {}

  uri(projectRelativePath: string): string {
    let mediaId = this.ids.get(projectRelativePath);
    if (!mediaId) {
      mediaId = randomUUID();
      this.ids.set(projectRelativePath, mediaId);
      this.paths.set(mediaId, projectRelativePath);
    }
    return `renku-direction://${this.sessionId}/media/${mediaId}`;
  }

  path(mediaId: string): string | undefined {
    return this.paths.get(mediaId);
  }
}

export class DialogueDirectionState {
  private readonly sessions = new Map<string, StoredSession>();

  create(sessionId: string, media: DirectionMediaRegistry, parts: DialogueDirectionSessionParts): DialogueDirectionSessionRecord {
    this.sessions.set(sessionId, { ...parts, sessionId, revision: 1, action: null, lastCompletedAction: null, consumedActionIds: new Set(), media });
    return this.record(sessionId);
  }

  record(sessionId: string): DialogueDirectionSessionRecord {
    const session = this.session(sessionId);
    return { ...session, action: session.action ? publicAction(session.action) : null };
  }

  touch(sessionId: string): void {
    this.session(sessionId).revision += 1;
  }

  startAction(sessionId: string, draft: DialogueDirectionDraft): DialogueDirectionAction {
    const session = this.session(sessionId);
    if (session.action && session.action.status !== 'failed') {
      throw directionError('CODEX_DIALOGUE_DIRECTION_BUSY', 'A Generate action is already outstanding for this panel.', 'Wait for the agent to report the current action before generating again.');
    }
    session.action = { actionId: randomUUID(), turnRange: { ...draft.turnRange }, status: 'pending', draft: structuredClone(draft) };
    session.revision += 1;
    return publicAction(session.action);
  }

  /** Returns the draft exactly once; undefined when the action was already consumed. */
  consume(sessionId: string, actionId: string): DialogueDirectionDraft | undefined {
    const session = this.session(sessionId);
    if (session.consumedActionIds.has(actionId)) return undefined;
    if (session.action?.actionId !== actionId || session.action.status !== 'pending') throw actionNotFound();
    session.action.status = 'running';
    session.consumedActionIds.add(actionId);
    session.revision += 1;
    return structuredClone(session.action.draft);
  }

  runningAction(sessionId: string, actionId: string): DialogueDirectionAction {
    const session = this.session(sessionId);
    if (session.action?.actionId === actionId && session.action.status === 'running') return publicAction(session.action);
    if (session.action?.actionId === actionId && session.action.status === 'pending') {
      throw directionError('CODEX_DIALOGUE_DIRECTION_INVALID', 'Consume the action before reporting its outcome.');
    }
    if (session.consumedActionIds.has(actionId)) {
      throw directionError('CODEX_DIALOGUE_DIRECTION_INVALID', 'This action outcome was already reported.');
    }
    throw actionNotFound();
  }

  completeAction(sessionId: string, actionId: string, takeId: string): void {
    this.runningAction(sessionId, actionId);
    const session = this.session(sessionId);
    session.action = null;
    session.lastCompletedAction = { actionId, takeId };
    session.revision += 1;
  }

  failAction(sessionId: string, actionId: string, message: string): void {
    this.runningAction(sessionId, actionId);
    const session = this.session(sessionId);
    session.action = { ...session.action!, status: 'failed', message };
    session.revision += 1;
  }

  expire(): void {
    this.sessions.clear();
  }

  private session(sessionId: string): StoredSession {
    const session = this.sessions.get(sessionId);
    if (!session) {
      throw directionError('CODEX_DIALOGUE_DIRECTION_NOT_FOUND', 'This dialogue direction session does not exist in this connection.', 'Open a fresh dialogue direction panel.');
    }
    return session;
  }
}

function publicAction(action: StoredAction): DialogueDirectionAction {
  return {
    actionId: action.actionId,
    turnRange: { ...action.turnRange } satisfies DialogueLineRange,
    status: action.status,
    ...(action.message !== undefined ? { message: action.message } : {}),
  };
}

function actionNotFound() {
  return directionError('CODEX_DIALOGUE_DIRECTION_NOT_FOUND', 'This dialogue direction action does not exist in this session.');
}
