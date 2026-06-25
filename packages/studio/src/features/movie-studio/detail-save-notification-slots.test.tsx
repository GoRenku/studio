// @vitest-environment jsdom
import React from 'react';
import { fireEvent, render, screen } from '@testing-library/react';
import { describe, expect, it } from 'vitest';
import { Button } from '@/ui/button';
import {
  setDetailSaveNotificationSlot,
  useDetailSaveNotificationSlots,
  type DetailSaveNotificationSlots,
} from './detail-save-notification-slots';
import {
  chooseDetailSaveNotification,
  idleSaveNotificationSlot,
} from './detail-save-notification';

describe('detail save notification slots', () => {
  it('combines multiple save sources by priority and latest sequence', () => {
    const slots: DetailSaveNotificationSlots = {
      'shot-design': idleSaveNotificationSlot,
      'ai-production': idleSaveNotificationSlot,
      references: idleSaveNotificationSlot,
      dialogs: idleSaveNotificationSlot,
    };

    const withSaved = setDetailSaveNotificationSlot(
      slots,
      'references',
      { state: 'saved', message: 'Saved' },
      1
    );
    const withSaving = setDetailSaveNotificationSlot(
      withSaved,
      'ai-production',
      { state: 'saving', message: 'Saving' },
      2
    );
    const withError = setDetailSaveNotificationSlot(
      withSaving,
      'dialogs',
      { state: 'error', message: 'Nope' },
      3
    );

    expect(chooseDetailSaveNotification(Object.values(withError))).toEqual({
      state: 'error',
      message: 'Nope',
    });
  });

  it('does not advance a slot when the status did not change', () => {
    const slots: DetailSaveNotificationSlots = {
      'shot-design': {
        status: { state: 'saved', message: 'Saved' },
        sequence: 4,
      },
      'ai-production': idleSaveNotificationSlot,
      references: idleSaveNotificationSlot,
      dialogs: idleSaveNotificationSlot,
    };

    expect(
      setDetailSaveNotificationSlot(
        slots,
        'shot-design',
        { state: 'saved', message: 'Saved' },
        5
      )
    ).toBe(slots);
  });

  it('lets SceneShotDetail-style callers update slots through the hook', () => {
    render(<DetailSaveNotificationSlotsHarness />);

    fireEvent.click(screen.getByRole('button', { name: 'Save references' }));
    expect(screen.getByText('saved:Saved')).toBeTruthy();

    fireEvent.click(screen.getByRole('button', { name: 'Fail dialogs' }));
    expect(screen.getByText('error:Dialog failed')).toBeTruthy();
  });
});

function DetailSaveNotificationSlotsHarness() {
  const {
    saveNotification,
    setDetailSaveNotificationSlot: setSlot,
  } = useDetailSaveNotificationSlots();

  return (
    <div>
      <p>{`${saveNotification.state}:${saveNotification.message ?? ''}`}</p>
      <Button
        type='button'
        onClick={() =>
          setSlot('references', { state: 'saved', message: 'Saved' })
        }
      >
        Save references
      </Button>
      <Button
        type='button'
        onClick={() =>
          setSlot('dialogs', { state: 'error', message: 'Dialog failed' })
        }
      >
        Fail dialogs
      </Button>
    </div>
  );
}
