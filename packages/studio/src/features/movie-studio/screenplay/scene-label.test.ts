import { describe, expect, it } from 'vitest';
import { displaySceneProductionNumber, sceneDisplayLabel } from './scene-label';

describe('scene display labels', () => {
  it('preserves the exact supplied production number', () => {
    expect(displaySceneProductionNumber('1')).toBe('1');
    expect(displaySceneProductionNumber('12')).toBe('12');
    expect(displaySceneProductionNumber('4A')).toBe('4A');
    expect(displaySceneProductionNumber('A4')).toBe('A4');
    expect(displaySceneProductionNumber(' 4aA ')).toBe(' 4aA ');
    expect(displaySceneProductionNumber('')).toBe('');
  });

  it('uses title, number, and heading without placeholder punctuation', () => {
    expect(
      sceneDisplayLabel({
        productionNumber: '1',
        heading: 'EXT. WALLS - DAWN',
        title: 'Bombardment',
      })
    ).toBe('1 - Bombardment');
    expect(
      sceneDisplayLabel({ productionNumber: '2', heading: 'INT. ARCHIVE - NIGHT' })
    ).toBe('2');
    expect(
      sceneDisplayLabel({ heading: 'INT. ARCHIVE - NIGHT', title: 'Records' })
    ).toBe('Records');
    expect(sceneDisplayLabel({ heading: 'INT. ARCHIVE - NIGHT' })).toBe(
      'INT. ARCHIVE - NIGHT'
    );
  });
});
