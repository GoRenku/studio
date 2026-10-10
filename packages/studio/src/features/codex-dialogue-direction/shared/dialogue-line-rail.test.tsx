// @vitest-environment jsdom
import { cleanup, fireEvent, render, screen, within } from '@testing-library/react';
import React, { useState } from 'react';
import { afterEach, describe, expect, it, vi } from 'vitest';
import type { DialogueDirectionTake, DialogueLineRange } from '@gorenku/studio-codex/dialogue-direction';
import { dialogueDirectionLinesFixture, dialogueDirectionTakeFixture } from '../testing/dialogue-direction-session-fixture';
import { DialogueLineRail } from './dialogue-line-rail';

afterEach(cleanup);

const media = { load: vi.fn(() => new Promise<string>(() => {})) };

function RailHarness({ initial, takes = [] }: { initial: DialogueLineRange; takes?: DialogueDirectionTake[] }) {
  const [selection, setSelection] = useState(initial);
  return <DialogueLineRail lines={dialogueDirectionLinesFixture()} takes={takes} selection={selection} media={media} onSelectionChange={setSelection} />;
}

function selectedLines(): number[] {
  return screen.getAllByRole('button', { pressed: true }).map((row) => Number(within(row).getAllByText(/^\d+$/)[0]!.textContent));
}

function row(number: number): HTMLElement {
  return screen.getAllByRole('button').find((button) => button.hasAttribute('aria-pressed') && within(button).queryByText(String(number)))!;
}

describe('DialogueLineRail', () => {
  it('selects one line on click and adjusts one continuous range on shift-click', () => {
    render(<RailHarness initial={{ start: 5, end: 5 }} />);
    fireEvent.click(row(8), { shiftKey: true });
    expect(selectedLines()).toEqual([5, 6, 7, 8]);
    fireEvent.click(row(8), { shiftKey: true });
    expect(selectedLines()).toEqual([5, 6, 7]);
    fireEvent.click(row(6), { shiftKey: true });
    expect(selectedLines()).toEqual([5, 6]);
    fireEvent.click(row(9));
    expect(selectedLines()).toEqual([9]);
  });

  it('offers + on unselected lines and − only on the selected range edges', () => {
    render(<RailHarness initial={{ start: 5, end: 7 }} />);
    expect(screen.queryByRole('button', { name: 'Remove line 6 from the selection' })).toBeNull();
    fireEvent.click(screen.getByRole('button', { name: 'Add line 9 to the selection' }));
    expect(selectedLines()).toEqual([5, 6, 7, 8, 9]);
    fireEvent.click(screen.getByRole('button', { name: 'Remove line 5 from the selection' }));
    expect(selectedLines()).toEqual([6, 7, 8, 9]);
  });

  it('counts covering Takes of this route and marks lines covered by any selected Take', () => {
    render(<RailHarness initial={{ start: 5, end: 5 }} takes={[
      dialogueDirectionTakeFixture('single', 7, 7),
      dialogueDirectionTakeFixture('range', 6, 8),
      dialogueDirectionTakeFixture('other-model', 4, 4, { matchesRoute: false, selected: true }),
      dialogueDirectionTakeFixture('other-model-range', 7, 9, { matchesRoute: false }),
    ]} />);
    expect(within(row(7)).getByText('2')).toBeTruthy();
    expect(within(row(4)).queryByText('1')).toBeNull();
    expect(row(4).querySelector('[data-selected-take]')).not.toBeNull();
    expect(row(7).querySelector('[data-selected-take]')).toBeNull();
    expect(row(5).querySelector('[data-selected-take]')).toBeNull();
    expect(row(9).querySelector('[data-selected-take]')).toBeNull();
  });
});
