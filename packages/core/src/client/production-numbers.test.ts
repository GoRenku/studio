import { describe, expect, it } from 'vitest';
import {
  allocateInitialProductionNumbers,
  allocateOrderedProductionNumber,
  alphabeticSuffix,
  formatProductionNumberForDisplay,
  isProductionNumber,
  productionNumberKey,
} from './production-numbers.js';

describe('stable production numbers', () => {
  it('validates numeric-first values and preserves exact authored case', () => {
    for (const value of ['1', '1A', '4aA', '28A', '100']) {
      expect(isProductionNumber(value)).toBe(true);
    }
    for (const value of ['', '0', '01', 'A1', '1-A', '1A2', ' 1']) {
      expect(isProductionNumber(value)).toBe(false);
    }
    expect(productionNumberKey('4aA')).toBe('4aa');
  });

  it('pads only single-digit display values', () => {
    expect(['1', '1A', '4aA', '28A', '100'].map(formatProductionNumberForDisplay)).toEqual([
      '01',
      '01A',
      '04aA',
      '28A',
      '100',
    ]);
  });

  it('allocates fresh, append, insertion, repeated, and never-recycled values', () => {
    expect(allocateInitialProductionNumbers(4)).toEqual(['1', '2', '3', '4']);
    expect(allocateOrderedProductionNumber({
      orderedNumbers: ['1', '2', '3'],
      reservedNumbers: ['1', '2', '3', '4'],
      placement: { position: 'end' },
    })).toBe('5');

    const firstInsert = allocateOrderedProductionNumber({
      orderedNumbers: ['1', '2', '3'],
      reservedNumbers: ['1', '2', '3'],
      placement: { position: 'insert', index: 1 },
    });
    expect(firstInsert).toBe('1A');
    expect(allocateOrderedProductionNumber({
      orderedNumbers: ['1', firstInsert, '2', '3'],
      reservedNumbers: ['1', '1A', '2', '3'],
      placement: { position: 'insert', index: 1 },
    })).toBe('1B');
    expect(allocateOrderedProductionNumber({
      orderedNumbers: ['1', '1B', '2', '3'],
      reservedNumbers: ['1', '1A', '1B', '2', '3'],
      placement: { position: 'insert', index: 1 },
    })).toBe('1C');
  });

  it('treats supplied occupied Scene numbers as opaque exact values', () => {
    expect(allocateOrderedProductionNumber({
      orderedNumbers: [],
      reservedNumbers: [],
      occupiedNumbers: ['A12', ' 1 ', '', '1'],
      placement: { position: 'end' },
    })).toBe('2');
    expect(allocateOrderedProductionNumber({
      orderedNumbers: ['1', '2'],
      reservedNumbers: ['1', '2'],
      occupiedNumbers: ['1A', '1a'],
      placement: { position: 'insert', index: 1 },
    })).toBe('1B');
  });

  it('rolls suffixes from Z to AA and treats case variants as reserved', () => {
    const oneLetterSuffixes = Array.from({ length: 26 }, (_, index) => `1${alphabeticSuffix(index + 1)}`);
    expect(allocateOrderedProductionNumber({
      orderedNumbers: ['1', '2'],
      reservedNumbers: ['1', '2', ...oneLetterSuffixes],
      placement: { position: 'insert', index: 1 },
    })).toBe('1AA');
    expect(allocateOrderedProductionNumber({
      orderedNumbers: ['1', '2'],
      reservedNumbers: ['1', '1a', '2'],
      placement: { position: 'insert', index: 1 },
    })).toBe('1B');
    expect(() => allocateOrderedProductionNumber({
      orderedNumbers: ['1', '2'],
      reservedNumbers: ['1', '2', ...oneLetterSuffixes],
      placement: { position: 'insert', index: 1 },
      maxSuffixLength: 1,
    })).toThrow('exhausted');
  });
});
