import { describe, expect, it } from 'vitest';
import {
  buildCharacterArcTimeline,
  dodge,
  groupTurningPointsByAct,
  TIMELINE_GUTTER,
  TIMELINE_WIDTH,
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
    expect(dodge([{ trueX: 200 }, { trueX: 205 }, { trueX: 300 }]).map((point) => point.x)).toEqual([200, 226, 300]);
  });

  it('omits markers with a missing first scene while preserving card numbers and stored points', () => {
    const resource = characterArcResource();
    resource.scenes = resource.scenes.filter((scene) => scene.id !== 'scene_2');

    const layout = buildCharacterArcTimeline(resource);

    expect(layout.arc.markers.map((marker) => marker.number)).toEqual([1, 3]);
    expect(resource.arc.turningPoints).toHaveLength(3);
    expect(groupTurningPointsByAct(resource).flatMap((group) => group.cards.map((card) => card.number))).toEqual([1, 2, 3]);
  });

  it('draws no trajectory or scene ticks when no anchors remain', () => {
    const layout = buildCharacterArcTimeline(characterArcResource({ scenes: [] }));
    expect(layout.arc.markers).toEqual([]);
    expect(layout.arc.path).toBe('');
    expect(layout.ticks).toEqual([]);
  });

  it.each(['first', 'last'] as const)('keeps crowded turning points in the %s of 100 scenes inside the plot', (anchor) => {
    const resource = characterArcResource();
    resource.scenes = Array.from({ length: 100 }, (_, index) => ({
      id: `scene_${index + 1}`,
      productionNumber: String(index + 1),
      heading: `Scene ${index + 1}`,
    }));
    resource.arc.turningPoints = resource.arc.turningPoints.slice(0, 2).map((point) => ({
      ...point,
      sceneIds: [anchor === 'first' ? 'scene_1' : 'scene_100'],
    }));

    const layout = buildCharacterArcTimeline(resource);
    const [first, second] = layout.arc.markers;

    expect(first!.x - 12).toBeGreaterThanOrEqual(TIMELINE_GUTTER);
    expect(second!.x + 12).toBeLessThanOrEqual(TIMELINE_WIDTH - 8);
    expect(second!.x - first!.x).toBeGreaterThanOrEqual(26);
    expect(first!.trueX).toBe(second!.trueX);
    expect(layout.arc.path).toBe(`M${first!.x},${first!.y} H${second!.x} V${second!.y} H1108`);
  });

  it('keeps a dense cluster ordered and bounded even when minimum spacing cannot fit', () => {
    const markers = dodge(Array.from({ length: 100 }, () => ({ trueX: 1103.21 })));
    expect(markers[0]!.x - 12).toBeCloseTo(TIMELINE_GUTTER);
    expect(markers[99]!.x + 12).toBeLessThanOrEqual(TIMELINE_WIDTH - 8);
    expect(markers.every((marker, index) => index === 0 || marker.x > markers[index - 1]!.x)).toBe(true);
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
