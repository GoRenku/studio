import { describe, expect, it } from 'vitest';
import type {
  SceneShot,
} from '@gorenku/studio-core/client';
import {
  buildTakeShotSelectionProjection,
  createTakeShotSelectionDraftsFromTakes,
  cycleTakeShotSelection,
  summarizeTakeShotSelectionChanges,
  takeShotSelectionLabels,
  takeShotSelectionTagLabel,
  type TakeShotSelectionDraft,
} from './shot-video-take-selection';

function shot(id: string): SceneShot {
  return {
    shotId: id,
    title: id,
    storyBeat: '',
    narrativePurpose: '',
    description: '',
    shotType: 'wide',
    subject: '',
    action: '',
    dialogue: [],
    coveredBlockIndexes: [],
    castMemberIds: [],
    locationIds: [],
  };
}

const SHOTS = ['s1', 's2', 's3', 's4', 's5'].map(shot);

function take(
  takeId: string,
  shotIds: string[]
): { takeId: string; shotIds: string[] } {
  return { takeId, shotIds };
}

function draft(
  draftSelectionId: string,
  shotIds: string[],
  input: Partial<TakeShotSelectionDraft> = {}
): TakeShotSelectionDraft {
  return { draftSelectionId, shotIds, ...input };
}

function cycle(
  selections: TakeShotSelectionDraft[],
  clickedShotId: string
): TakeShotSelectionDraft[] {
  return cycleTakeShotSelection({
    shots: SHOTS,
    draftSelections: selections,
    clickedShotId,
    createDraftSelectionId: () => 'new_selection',
  });
}

function shotIds(selections: TakeShotSelectionDraft[]): string[][] {
  return selections.map((selection) => selection.shotIds);
}

function summary(
  persistedShotIds: string[],
  draftShotIds: string[]
): string[] {
  return summarizeTakeShotSelectionChanges({
    shots: SHOTS,
    persistedDraftSelections: [draft('take_1', persistedShotIds, { takeId: 'take_1' })],
    draftSelections: [draft('take_1', draftShotIds, { takeId: 'take_1' })],
  }).messages;
}

describe('buildTakeShotSelectionProjection', () => {
  it('marks one-shot and multi-shot selection bounds with alternating variants', () => {
    const projection = buildTakeShotSelectionProjection(SHOTS, [
      draft('first_selection', ['s1']),
      draft('second_selection', ['s3', 's4']),
    ]);
    expect(projection.entries[0]).toMatchObject({
      takeId: 'first_selection',
      selectionSize: 1,
      isSelectionStart: true,
      isSelectionEnd: true,
      variant: 0,
    });
    expect(projection.entries[2].variant).toBe(1);
    expect(projection.entries[3].isSelectionEnd).toBe(true);
    expect(projection.entries[1].takeId).toBeNull();
  });

  it('ignores stale selection shot ids that are not in the visible shot list', () => {
    const projection = buildTakeShotSelectionProjection(SHOTS, [
      draft('stale_selection', ['missing_shot']),
    ]);

    expect(projection.entries.map((entry) => entry.takeId)).toEqual([
      null,
      null,
      null,
      null,
      null,
    ]);
  });
});

describe('cycleTakeShotSelection', () => {
  it('creates one take-owned selection when no shot is selected', () => {
    expect(shotIds(cycle([], 's3'))).toEqual([['s3']]);
  });

  it('expands a selected range from either adjacent edge', () => {
    expect(
      shotIds(cycle([draft('take_1', ['s2', 's3'], { takeId: 'take_1' })], 's1'))
    ).toEqual([['s1', 's2', 's3']]);
    expect(
      shotIds(cycle([draft('take_1', ['s2', 's3'], { takeId: 'take_1' })], 's4'))
    ).toEqual([['s2', 's3', 's4']]);
  });

  it('replaces the current selection when a non-contiguous shot is selected', () => {
    const result = cycle(
      [draft('take_1', ['s1', 's2', 's3'], { takeId: 'take_1' })],
      's5'
    );

    expect(result).toEqual([
      {
        draftSelectionId: 'take_1',
        takeId: 'take_1',
        shotIds: ['s5'],
      },
    ]);
  });

  it('removes edge shots and preserves the rest of the contiguous selection', () => {
    expect(
      shotIds(cycle([draft('take_1', ['s1', 's2'], { takeId: 'take_1' })], 's2'))
    ).toEqual([['s1']]);
    expect(
      shotIds(cycle([draft('take_1', ['s1', 's2'], { takeId: 'take_1' })], 's1'))
    ).toEqual([['s2']]);
  });

  it('deselects an interior shot by keeping the upper contiguous portion only', () => {
    expect(
      shotIds(
        cycle(
          [draft('take_1', ['s1', 's2', 's3', 's4'], { takeId: 'take_1' })],
          's3'
        )
      )
    ).toEqual([['s1', 's2']]);
  });

  it('preserves the take draft while the local selection is empty', () => {
    const withoutSecond = cycle(
      [draft('take_1', ['s1', 's2'], { takeId: 'take_1' })],
      's2'
    );
    const withoutFirst = cycle(withoutSecond, 's1');

    expect(withoutFirst).toEqual([
      {
        draftSelectionId: 'take_1',
        takeId: 'take_1',
        shotIds: [],
      },
    ]);
    expect(shotIds(cycle(withoutFirst, 's4'))).toEqual([['s4']]);
  });

  it('handles deselecting the top edge, then the remaining shot, then selecting elsewhere', () => {
    const withoutFirst = cycle(
      [draft('take_1', ['s1', 's2'], { takeId: 'take_1' })],
      's1'
    );
    const withoutSecond = cycle(withoutFirst, 's2');

    expect(shotIds(cycle(withoutSecond, 's4'))).toEqual([['s4']]);
  });

  it('drops stale shot ids before applying a local click', () => {
    const result = cycle(
      [
        draft('take_1', ['missing_shot'], {
          takeId: 'take_1',
        }),
      ],
      's2'
    );

    expect(result).toEqual([
      {
        draftSelectionId: 'take_1',
        takeId: 'take_1',
        shotIds: ['s2'],
      },
    ]);
  });
});

describe('save projection and labels', () => {
  it('creates drafts from takes', () => {
    expect(
      createTakeShotSelectionDraftsFromTakes([
        take('take_1', ['s2']),
      ])
    ).toEqual([
      {
        draftSelectionId: 'take_1',
        takeId: 'take_1',
        shotIds: ['s2'],
      },
    ]);
  });

  it('renders meaningful labels for one-shot and multi-shot selections', () => {
    expect(takeShotSelectionLabels(SHOTS, { shotIds: ['s3', 's4'] })).toEqual([
      'Shot 3',
      'Shot 4',
    ]);
    expect(takeShotSelectionTagLabel(SHOTS, { shotIds: ['s3'] })).toBe('Shot 3');
    expect(takeShotSelectionTagLabel(SHOTS, { shotIds: ['s3', 's4'] })).toBe('Shot 3-4');
  });

  it('summarizes non-contiguous replacement as deselect plus select', () => {
    expect(summary(['s1', 's2', 's3'], ['s5'])).toEqual([
      'Deselect Shot 1-3 and select Shot 5.',
    ]);
  });

  it('summarizes interior deselection as one selection change', () => {
    const result = summarizeTakeShotSelectionChanges({
      shots: SHOTS,
      persistedDraftSelections: [
        draft('take_1', ['s1', 's2', 's3', 's4'], { takeId: 'take_1' }),
      ],
      draftSelections: [
        draft('take_1', ['s1', 's2'], { takeId: 'take_1' }),
      ],
    });

    expect(result).toEqual({
      changedPromptCount: 1,
      messages: ['Change selection from Shot 1-4 to Shot 1-2.'],
    });
  });

  it('summarizes empty local selection as deselection only', () => {
    expect(summary(['s1', 's2'], [])).toEqual([
      'Deselect Shot 1-2.',
    ]);
  });
});
