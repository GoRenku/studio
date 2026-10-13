import type { StudioProjectRef } from '@gorenku/studio-core/server';
import type { RouteChoiceAnswer, RouteChooser } from './contracts.js';
import { routeChoiceError } from './diagnostics.js';

export interface RouteChooserRecord {
  chooser: Omit<RouteChooser, 'revision' | 'answer'>;
  projectRef: StudioProjectRef;
  revision: number;
  answer: RouteChoiceAnswer | null;
  laneSettingsChanged: boolean;
  consumed: boolean;
}

/** Connection-local Route Choosers: the user answers once and the agent consumes that answer once. */
export class RouteChooserState {
  private readonly choosers = new Map<string, RouteChooserRecord>();

  create(chooser: RouteChooserRecord['chooser'], projectRef: StudioProjectRef): RouteChooser {
    this.choosers.set(chooser.choiceId, { chooser, projectRef, revision: 1, answer: null, laneSettingsChanged: false, consumed: false });
    return this.chooser(chooser.choiceId);
  }

  record(choiceId: string): RouteChooserRecord {
    const record = this.choosers.get(choiceId);
    if (!record) {
      throw routeChoiceError('CODEX_ROUTE_CHOICE_NOT_FOUND', 'This Route Chooser does not exist in this connection.', 'Ask the agent to open the Route Chooser again.');
    }
    return record;
  }

  chooser(choiceId: string): RouteChooser {
    const record = this.record(choiceId);
    return structuredClone({ ...record.chooser, revision: record.revision, answer: record.answer });
  }

  answer(choiceId: string, answer: RouteChoiceAnswer, laneSettingsChanged: boolean): RouteChooser {
    const record = this.record(choiceId);
    record.answer = structuredClone(answer);
    record.laneSettingsChanged = laneSettingsChanged;
    record.revision += 1;
    return this.chooser(choiceId);
  }

  /** Returns the record once after it was answered; undefined when it was already consumed. */
  consume(choiceId: string): RouteChooserRecord | undefined {
    const record = this.record(choiceId);
    if (record.consumed) return undefined;
    if (!record.answer) {
      throw routeChoiceError('CODEX_ROUTE_CHOICE_INVALID', 'The user has not chosen a provider and model yet.', 'End the turn and wait for the Route Chooser message.');
    }
    record.consumed = true;
    record.revision += 1;
    return structuredClone(record);
  }

  expire(): void {
    this.choosers.clear();
  }
}
