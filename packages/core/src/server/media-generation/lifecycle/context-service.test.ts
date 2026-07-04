import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../renku-config.js', () => ({
  readAgentMediaExecutionPolicy: vi.fn(),
}));

vi.mock('./purpose-lifecycle-registry.js', () => ({
  requireMediaGenerationPurposeDefinition: vi.fn(),
}));

import { readAgentMediaExecutionPolicy } from '../../renku-config.js';
import { requireMediaGenerationPurposeDefinition } from './purpose-lifecycle-registry.js';
import {
  buildAgentMediaReport,
  buildMediaGenerationContext,
  decorateAgentMediaReport,
} from './context-service.js';

const mockedReadPolicy = vi.mocked(readAgentMediaExecutionPolicy);
const mockedRequireDefinition = vi.mocked(requireMediaGenerationPurposeDefinition);

describe('media generation lifecycle context service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedReadPolicy.mockResolvedValue({
      imageGeneration: {
        defaultExecutionPath: 'renku-managed',
      },
    } as never);
  });

  it('builds agent media reports only for image purposes', async () => {
    await expect(
      buildAgentMediaReport({ homeDir: '/home', mediaKind: 'image' })
    ).resolves.toMatchObject({
      imageGeneration: {
        defaultExecutionPath: 'renku-managed',
        appliesToPurpose: true,
        renkuManagedAvailable: true,
        externalBuiltInGeneration: {
          preferred: 'codex.gpt-image-2',
          availableInRenku: false,
        },
      },
    });

    await expect(
      buildAgentMediaReport({ homeDir: '/home', mediaKind: 'audio' })
    ).resolves.toMatchObject({
      imageGeneration: {
        appliesToPurpose: false,
        renkuManagedAvailable: false,
        externalBuiltInGeneration: { preferred: null },
      },
    });
  });

  it('decorates image reports with agent media guidance and leaves non-images quiet', async () => {
    await expect(
      decorateAgentMediaReport({
        report: { purpose: 'lookbook.image' },
        input: { homeDir: '/home' },
        mediaKind: 'image',
      })
    ).resolves.toMatchObject({
      purpose: 'lookbook.image',
      agentMedia: {
        imageGeneration: {
          defaultExecutionPath: 'renku-managed',
        },
      },
    });

    await expect(
      decorateAgentMediaReport({
        report: { purpose: 'scene.dialogue-audio' },
        input: { homeDir: '/home' },
        mediaKind: 'audio',
      })
    ).resolves.toEqual({ purpose: 'scene.dialogue-audio' });
  });

  it('delegates context creation to the owning purpose definition', async () => {
    const buildContext = vi.fn(async () => ({
      purpose: 'lookbook.image',
      target: { kind: 'lookbook', id: 'lookbook-a' },
    }));
    mockedRequireDefinition.mockReturnValueOnce({
      purpose: 'lookbook.image',
      mediaKind: 'image',
      buildContext,
    } as never);

    await expect(
      buildMediaGenerationContext({
        homeDir: '/home',
        purpose: 'lookbook.image',
        target: { kind: 'lookbook', id: 'lookbook-a' },
      })
    ).resolves.toMatchObject({
      purpose: 'lookbook.image',
      target: { kind: 'lookbook', id: 'lookbook-a' },
      agentMedia: {
        imageGeneration: {
          defaultExecutionPath: 'renku-managed',
        },
      },
    });

    expect(buildContext).toHaveBeenCalledWith({
      homeDir: '/home',
      purpose: 'lookbook.image',
      target: { kind: 'lookbook', id: 'lookbook-a' },
    });
  });
});
