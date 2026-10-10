import { describe, expect, it } from 'vitest';
import { adjustDialogueLineRange, dialogueLineGutterAction } from './dialogue-line-range';

describe('dialogue line range adjustment', () => {
  it('extends through an unselected line and fills the gap on either side', () => {
    expect(adjustDialogueLineRange({ start: 5, end: 5 }, 5, 8)).toEqual({ start: 5, end: 8 });
    expect(adjustDialogueLineRange({ start: 6, end: 7 }, 6, 4)).toEqual({ start: 4, end: 7 });
  });

  it('removes the first or last selected line', () => {
    expect(adjustDialogueLineRange({ start: 5, end: 8 }, 5, 5)).toEqual({ start: 6, end: 8 });
    expect(adjustDialogueLineRange({ start: 5, end: 8 }, 5, 8)).toEqual({ start: 5, end: 7 });
  });

  it('trims back to an inner line from the anchor line', () => {
    expect(adjustDialogueLineRange({ start: 4, end: 9 }, 4, 6)).toEqual({ start: 4, end: 6 });
    expect(adjustDialogueLineRange({ start: 4, end: 9 }, 9, 6)).toEqual({ start: 6, end: 9 });
    expect(adjustDialogueLineRange({ start: 4, end: 9 }, 2, 6)).toEqual({ start: 4, end: 6 });
  });

  it('keeps a single selected line when it is adjusted again', () => {
    expect(adjustDialogueLineRange({ start: 7, end: 7 }, 7, 7)).toEqual({ start: 7, end: 7 });
  });

  it('offers add outside the selection and remove only on the edges of a range', () => {
    expect(dialogueLineGutterAction({ start: 5, end: 7 }, 4)).toBe('add');
    expect(dialogueLineGutterAction({ start: 5, end: 7 }, 5)).toBe('remove');
    expect(dialogueLineGutterAction({ start: 5, end: 7 }, 7)).toBe('remove');
    expect(dialogueLineGutterAction({ start: 5, end: 7 }, 6)).toBeNull();
    expect(dialogueLineGutterAction({ start: 5, end: 5 }, 5)).toBeNull();
  });
});
