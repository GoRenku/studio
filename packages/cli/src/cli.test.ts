import { describe, expect, it } from 'vitest';
import { parseGenerationPurpose, parseGenerationTarget } from './commands/generation-purpose-command-registry.js';

describe('Renku CLI generation parsing', () => {
  it('uses current purpose names and exact targets', () => {
    const purpose = parseGenerationPurpose('location.sheet');
    expect(parseGenerationTarget({ purpose, target: 'location:basilica' })).toEqual({ kind: 'location', id: 'basilica' });
  });
});
