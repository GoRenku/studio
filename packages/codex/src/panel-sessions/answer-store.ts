import type { StructuredError } from '@gorenku/studio-diagnostics';

export interface PanelAnswerErrors {
  notFound: () => StructuredError;
  alreadyAnswered: () => StructuredError;
  notAnswered: () => StructuredError;
}

/** What the panel reads: the opening view plus the shared revision and answer. */
export type AnsweredPanel<TPanel extends { panelId: string }, TAnswer> = TPanel & {
  revision: number;
  answer: TAnswer | null;
};

export interface PanelAnswerRecord<TPanel extends { panelId: string }, TAnswer, TContext> {
  panel: TPanel;
  /** Connection-local data the panel never sees, such as the project reference and media registry. */
  context: TContext;
  revision: number;
  answer: TAnswer | null;
  consumed: boolean;
}

/**
 * Connection-local one-answer panels: the user answers once and the agent consumes that answer once.
 * Every change bumps the revision.
 */
export class PanelAnswerStore<TPanel extends { panelId: string }, TAnswer, TContext> {
  private readonly records = new Map<string, PanelAnswerRecord<TPanel, TAnswer, TContext>>();

  constructor(private readonly errors: PanelAnswerErrors) {}

  create(panel: TPanel, context: TContext): AnsweredPanel<TPanel, TAnswer> {
    this.records.set(panel.panelId, { panel, context, revision: 1, answer: null, consumed: false });
    return this.read(panel.panelId);
  }

  record(panelId: string): PanelAnswerRecord<TPanel, TAnswer, TContext> {
    const record = this.records.get(panelId);
    if (!record) throw this.errors.notFound();
    return record;
  }

  read(panelId: string): AnsweredPanel<TPanel, TAnswer> {
    const record = this.record(panelId);
    return structuredClone({ ...record.panel, revision: record.revision, answer: record.answer });
  }

  answer(panelId: string, answer: TAnswer): AnsweredPanel<TPanel, TAnswer> {
    const record = this.record(panelId);
    if (record.answer) throw this.errors.alreadyAnswered();
    record.answer = structuredClone(answer);
    record.revision += 1;
    return this.read(panelId);
  }

  /** Returns the answer once; undefined when it was already consumed. */
  consume(panelId: string): TAnswer | undefined {
    const record = this.record(panelId);
    if (record.consumed) return undefined;
    if (!record.answer) throw this.errors.notAnswered();
    record.consumed = true;
    record.revision += 1;
    return structuredClone(record.answer);
  }

  expire(): void {
    this.records.clear();
  }
}
