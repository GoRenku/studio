import { describe, expect, it } from 'vitest';
import { generationResourceChangedReport } from './generation-command.js';

describe('generationResourceChangedReport', () => {
  it('does not synthesize resource changes for read-only generic commands', () => {
    expect(generationResourceChangedReport(['context'], {})).toBeNull();
  });
});
