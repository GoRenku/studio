import { describe, expect, it } from 'vitest';
import {
  chooseDetailSaveNotification,
  idleSaveNotification,
  saveNotificationStatusesEqual,
} from './detail-save-notification';

describe('detail save notifications', () => {
  it('compares statuses by visible save state and message', () => {
    expect(
      saveNotificationStatusesEqual(
        { state: 'saved', message: 'Saved' },
        { state: 'saved', message: 'Saved' }
      )
    ).toBe(true);
    expect(
      saveNotificationStatusesEqual(
        { state: 'saved', message: 'Saved' },
        { state: 'saved', message: 'Saved changes' }
      )
    ).toBe(false);
    expect(
      saveNotificationStatusesEqual(
        { state: 'saved', message: 'Saved' },
        { state: 'saving', message: 'Saved' }
      )
    ).toBe(false);
  });

  it('keeps the highest priority status visible', () => {
    expect(
      chooseDetailSaveNotification([
        { status: idleSaveNotification, sequence: 3 },
        { status: { state: 'saving', message: 'Saving' }, sequence: 2 },
        { status: { state: 'saved', message: 'Saved' }, sequence: 1 },
      ])
    ).toEqual({ state: 'saving', message: 'Saving' });
  });
});
