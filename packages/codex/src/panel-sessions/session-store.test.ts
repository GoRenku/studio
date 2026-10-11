import { StructuredError } from '@gorenku/studio-diagnostics';
import { describe, expect, it } from 'vitest';
import { PanelSessionStore } from './session-store.js';

const error = (code: string) => () => new StructuredError({ code, message: code });

function store() {
  return new PanelSessionStore<{ label: string }, { value: number }, { target: string }, { actionId: string; resultId: string }>({
    busy: error('BUSY'),
    sessionNotFound: error('SESSION_NOT_FOUND'),
    actionNotFound: error('ACTION_NOT_FOUND'),
    invalid: (message) => new StructuredError({ code: 'INVALID', message }),
  });
}

describe('PanelSessionStore', () => {
  it('runs one action through pending, running and completion, bumping the revision each time', () => {
    const sessions = store();
    expect(sessions.create('s', { label: 'panel' })).toMatchObject({ sessionId: 's', revision: 1, label: 'panel', action: null, lastCompletedAction: null });
    const action = sessions.startAction('s', { value: 1 }, { target: 'a' });
    expect(action).toMatchObject({ target: 'a', status: 'pending' });
    expect(() => sessions.startAction('s', { value: 2 }, { target: 'b' })).toThrow(expect.objectContaining({ code: 'BUSY' }));
    expect(sessions.consume('s', action.actionId)).toEqual({ value: 1 });
    expect(sessions.consume('s', action.actionId)).toBeUndefined();
    sessions.completeAction('s', action.actionId, { actionId: action.actionId, resultId: 'r' });
    expect(sessions.record('s')).toMatchObject({ revision: 4, action: null, lastCompletedAction: { actionId: action.actionId, resultId: 'r' } });
    expect(() => sessions.runningAction('s', action.actionId)).toThrow(expect.objectContaining({ code: 'INVALID' }));
  });

  it('allows a new action after a failure and keeps the failure message visible until then', () => {
    const sessions = store();
    sessions.create('s', { label: 'panel' });
    const action = sessions.startAction('s', { value: 1 }, { target: 'a' });
    expect(() => sessions.runningAction('s', action.actionId)).toThrow(expect.objectContaining({ code: 'INVALID' }));
    sessions.consume('s', action.actionId);
    sessions.failAction('s', action.actionId, 'Provider failed.');
    expect(sessions.record('s').action).toMatchObject({ status: 'failed', message: 'Provider failed.', target: 'a' });
    expect(sessions.startAction('s', { value: 2 }, { target: 'b' })).toMatchObject({ status: 'pending', target: 'b' });
  });

  it('applies part updates with a new revision and reports unknown sessions and actions', () => {
    const sessions = store();
    sessions.create('s', { label: 'panel' });
    sessions.update('s', (parts) => { parts.label = 'changed'; });
    expect(sessions.record('s')).toMatchObject({ label: 'changed', revision: 2 });
    expect(() => sessions.record('missing')).toThrow(expect.objectContaining({ code: 'SESSION_NOT_FOUND' }));
    expect(() => sessions.consume('s', 'missing')).toThrow(expect.objectContaining({ code: 'ACTION_NOT_FOUND' }));
  });
});
