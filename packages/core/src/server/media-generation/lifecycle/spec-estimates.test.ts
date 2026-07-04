import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../database/access/media-generation.js', () => ({
  requireMediaGenerationSpec: vi.fn(),
}));

vi.mock('../cost/spec-estimates.js', () => ({
  estimateMediaGenerationSpecRecord: vi.fn(),
}));

vi.mock('./project-session.js', () => ({
  withMediaGenerationEstimationProjectSession: vi.fn(),
}));

import { requireMediaGenerationSpec } from '../../database/access/media-generation.js';
import { estimateMediaGenerationSpecRecord } from '../cost/spec-estimates.js';
import { withMediaGenerationEstimationProjectSession } from './project-session.js';
import { estimateMediaGenerationSpec } from './spec-estimates.js';

const mockedRequireSpec = vi.mocked(requireMediaGenerationSpec);
const mockedEstimateRecord = vi.mocked(estimateMediaGenerationSpecRecord);
const mockedWithSession = vi.mocked(withMediaGenerationEstimationProjectSession);

describe('media generation lifecycle spec estimates', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedWithSession.mockImplementation(async (_input, fn) =>
      fn({ session: { kind: 'session' } } as never)
    );
  });

  it('reads persisted specs through an estimation session before delegating to cost', async () => {
    const specRecord = {
      id: 'spec-a',
      purpose: 'lookbook.image',
      spec: { purpose: 'lookbook.image' },
    };
    mockedRequireSpec.mockReturnValueOnce(specRecord as never);
    mockedEstimateRecord.mockResolvedValueOnce({
      estimate: { state: 'priced', estimatedCostUsd: 0.2 },
    } as never);

    await expect(
      estimateMediaGenerationSpec({ specId: 'spec-a', homeDir: '/home' } as never)
    ).resolves.toEqual({
      estimate: { state: 'priced', estimatedCostUsd: 0.2 },
    });

    expect(mockedRequireSpec).toHaveBeenCalledWith(
      { kind: 'session' },
      'spec-a'
    );
    expect(mockedEstimateRecord).toHaveBeenCalledWith(specRecord, {
      specId: 'spec-a',
      homeDir: '/home',
    });
  });
});
