import { randomUUID } from 'node:crypto';
import type { StructuredError } from '@gorenku/studio-diagnostics';

export type PanelActionStatus = 'pending' | 'running' | 'failed';

/** The panel-visible action: family details plus the shared lifecycle fields. */
export type PanelAction<TDetails extends object> = TDetails & {
  actionId: string;
  status: PanelActionStatus;
  message?: string;
};

export interface PanelSessionErrors {
  busy: () => StructuredError;
  sessionNotFound: () => StructuredError;
  actionNotFound: () => StructuredError;
  invalid: (message: string) => StructuredError;
}

export type PanelSessionRecord<TParts extends object, TDetails extends object, TCompletion> = TParts & {
  sessionId: string;
  revision: number;
  action: PanelAction<TDetails> | null;
  lastCompletedAction: TCompletion | null;
};

interface StoredAction<TDraft, TDetails extends object> {
  actionId: string;
  status: PanelActionStatus;
  message?: string;
  details: TDetails;
  draft: TDraft;
}

interface StoredSession<TParts extends object, TDraft, TDetails extends object, TCompletion> {
  sessionId: string;
  parts: TParts;
  revision: number;
  action: StoredAction<TDraft, TDetails> | null;
  lastCompletedAction: TCompletion | null;
  consumedActionIds: Set<string>;
}

/**
 * Connection-local panel sessions with one outstanding Generate action at a time.
 * Every mutation bumps the revision so panels can ignore stale reads.
 */
export class PanelSessionStore<TParts extends object, TDraft, TDetails extends object, TCompletion> {
  private readonly sessions = new Map<string, StoredSession<TParts, TDraft, TDetails, TCompletion>>();

  constructor(private readonly errors: PanelSessionErrors) {}

  create(sessionId: string, parts: TParts): PanelSessionRecord<TParts, TDetails, TCompletion> {
    this.sessions.set(sessionId, { sessionId, parts, revision: 1, action: null, lastCompletedAction: null, consumedActionIds: new Set() });
    return this.record(sessionId);
  }

  record(sessionId: string): PanelSessionRecord<TParts, TDetails, TCompletion> {
    const session = this.session(sessionId);
    return {
      ...session.parts,
      sessionId: session.sessionId,
      revision: session.revision,
      action: session.action ? publicAction(session.action) : null,
      lastCompletedAction: session.lastCompletedAction,
    };
  }

  touch(sessionId: string): void {
    this.session(sessionId).revision += 1;
  }

  update(sessionId: string, change: (parts: TParts) => void): void {
    const session = this.session(sessionId);
    change(session.parts);
    session.revision += 1;
  }

  startAction(sessionId: string, draft: TDraft, details: TDetails): PanelAction<TDetails> {
    const session = this.session(sessionId);
    if (session.action && session.action.status !== 'failed') throw this.errors.busy();
    session.action = { actionId: randomUUID(), status: 'pending', details: structuredClone(details), draft: structuredClone(draft) };
    session.revision += 1;
    return publicAction(session.action);
  }

  /** Returns the draft exactly once; undefined when the action was already consumed. */
  consume(sessionId: string, actionId: string): TDraft | undefined {
    const session = this.session(sessionId);
    if (session.consumedActionIds.has(actionId)) return undefined;
    if (session.action?.actionId !== actionId || session.action.status !== 'pending') throw this.errors.actionNotFound();
    session.action.status = 'running';
    session.consumedActionIds.add(actionId);
    session.revision += 1;
    return structuredClone(session.action.draft);
  }

  runningAction(sessionId: string, actionId: string): PanelAction<TDetails> {
    const session = this.session(sessionId);
    if (session.action?.actionId === actionId && session.action.status === 'running') return publicAction(session.action);
    if (session.action?.actionId === actionId && session.action.status === 'pending') {
      throw this.errors.invalid('Consume the action before reporting its outcome.');
    }
    if (session.consumedActionIds.has(actionId)) throw this.errors.invalid('This action outcome was already reported.');
    throw this.errors.actionNotFound();
  }

  completeAction(sessionId: string, actionId: string, completion: TCompletion): void {
    this.runningAction(sessionId, actionId);
    const session = this.session(sessionId);
    session.action = null;
    session.lastCompletedAction = completion;
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

  private session(sessionId: string): StoredSession<TParts, TDraft, TDetails, TCompletion> {
    const session = this.sessions.get(sessionId);
    if (!session) throw this.errors.sessionNotFound();
    return session;
  }
}

function publicAction<TDraft, TDetails extends object>(action: StoredAction<TDraft, TDetails>): PanelAction<TDetails> {
  return {
    ...structuredClone(action.details),
    actionId: action.actionId,
    status: action.status,
    ...(action.message !== undefined ? { message: action.message } : {}),
  };
}
