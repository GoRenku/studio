import { describe, expect, it } from 'vitest';
import { displaySceneProductionNumber, sceneDisplayLabel } from './scene-label';

describe('scene display labels', () => {
  it('pads only a one-digit numeric production number', () => {
    expect(displaySceneProductionNumber('1')).toBe('01');
    expect(displaySceneProductionNumber('12')).toBe('12');
    expect(displaySceneProductionNumber('4A')).toBe('4A');
    expect(displaySceneProductionNumber('A4')).toBe('A4');
    expect(displaySceneProductionNumber('4aA')).toBe('4aA');
  });

  it('uses title, number, and heading without placeholder punctuation', () => {
    expect(
      sceneDisplayLabel({
        productionNumber: '1',
        heading: 'EXT. WALLS - DAWN',
        title: 'Bombardment',
      })
    ).toBe('01 - Bombardment');
    expect(
      sceneDisplayLabel({ heading: 'INT. ARCHIVE - NIGHT' })
    ).toBe('INT. ARCHIVE - NIGHT');
  });
});
