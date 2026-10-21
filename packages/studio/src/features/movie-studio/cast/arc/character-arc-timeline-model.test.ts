import { describe, expect, it } from 'vitest';
import {
  buildCharacterArcTimeline,
  dodge,
  groupTurningPointsByAct,
} from './character-arc-timeline-model';
import { characterArcResource } from './character-arc-test-fixtures';

describe('character arc timeline model', () => {
  it('places turning points by their first scene and draws a staircase between them', () => {
    const layout = buildCharacterArcTimeline(characterArcResource());
    const [first, second, third] = layout.arc.markers;
    expect(first!.x).toBeLessThan(second!.x);
    expect(second!.x).toBeLessThan(third!.x);
    expect(second!.y).toBeGreaterThan(first!.y);
    expect(layout.arc.path).toBe(
      `M${first!.x},${first!.y} H${second!.x} V${second!.y} H${third!.x} V${third!.y} H1108`
    );
  });

  it('nudges markers apart when turning points share or crowd a scene', () => {
    expect(dodge([{ trueX: 100 }, { trueX: 105 }, { trueX: 200 }]).map((point) => point.x)).toEqual([100, 126, 200]);
  });

  it('builds act bands and beat labels from the analysis, and hides presence without references', () => {
    const layout = buildCharacterArcTimeline(characterArcResource({ presence: [] }));
    expect(layout.acts.map((act) => act.label)).toEqual(['Act I', 'Act II', 'Act III']);
    expect(layout.beats.map((beat) => beat.label)).toEqual(['Midpoint', 'Climax']);
    expect(layout.presence).toBeNull();
  });

  it('draws no acts or beats without an active analysis, and keeps the scene axis', () => {
    const layout = buildCharacterArcTimeline(characterArcResource({ structure: null }));
    expect(layout.acts).toEqual([]);
    expect(layout.beats).toEqual([]);
    expect(layout.ticks.map((tick) => tick.label)).toEqual(['1', '4']);
  });

  it('groups cards by act and marks which way each turn moves', () => {
    expect(groupTurningPointsByAct(characterArcResource())).toEqual([
      { label: 'Act I', cards: [{ number: 1, turningPointIndex: 0, shift: null }] },
      { label: 'Act II', cards: [{ number: 2, turningPointIndex: 1, shift: 'down' }] },
      { label: 'Act III', cards: [{ number: 3, turningPointIndex: 2, shift: 'up' }] },
    ]);
  });
});
