import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./purpose-lifecycle-registry.js', () => ({
  requireMediaGenerationPurposeDefinition: vi.fn(),
}));

vi.mock('./context-service.js', () => ({
  decorateAgentMediaReport: vi.fn(),
}));

import { decorateAgentMediaReport } from './context-service.js';
import { listMediaGenerationModels } from './model-service.js';
import { requireMediaGenerationPurposeDefinition } from './purpose-lifecycle-registry.js';

const mockedDecorateReport = vi.mocked(decorateAgentMediaReport);
const mockedRequireDefinition = vi.mocked(requireMediaGenerationPurposeDefinition);

describe('media generation lifecycle model service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedDecorateReport.mockImplementation(async ({ report }) => ({
      ...report,
      decorated: true,
    }) as never);
  });

  it('delegates model listing to the owning purpose and decorates image reports', async () => {
    const listModels = vi.fn(async () => ({
      purpose: 'lookbook.image',
      models: [{ modelChoice: 'fal-ai/nano-banana-2' }],
    }));
    mockedRequireDefinition.mockReturnValueOnce({
      purpose: 'lookbook.image',
      mediaKind: 'image',
      listModels,
    } as never);

    await expect(
      listMediaGenerationModels({
        homeDir: '/home',
        purpose: 'lookbook.image',
        target: { kind: 'lookbook', id: 'lookbook-a' },
      })
    ).resolves.toEqual({
      purpose: 'lookbook.image',
      models: [{ modelChoice: 'fal-ai/nano-banana-2' }],
      decorated: true,
    });

    expect(listModels).toHaveBeenCalledWith({
      homeDir: '/home',
      purpose: 'lookbook.image',
      target: { kind: 'lookbook', id: 'lookbook-a' },
    });
    expect(mockedDecorateReport).toHaveBeenCalledWith({
      report: {
        purpose: 'lookbook.image',
        models: [{ modelChoice: 'fal-ai/nano-banana-2' }],
      },
      input: {
        homeDir: '/home',
        purpose: 'lookbook.image',
        target: { kind: 'lookbook', id: 'lookbook-a' },
      },
      mediaKind: 'image',
    });
  });
});
