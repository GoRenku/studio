import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('../../database/access/media-generation.js', () => ({
  requireMediaGenerationSpec: vi.fn(),
}));

vi.mock('./dependency-service.js', () => ({
  assertRootDependenciesResolved: vi.fn(),
}));

vi.mock('./project-session.js', () => ({
  withMediaGenerationProjectSession: vi.fn(),
}));

vi.mock('./purpose-lifecycle-registry.js', () => ({
  requireMediaGenerationPurposeDefinition: vi.fn(),
}));

import { requireMediaGenerationSpec } from '../../database/access/media-generation.js';
import { assertRootDependenciesResolved } from './dependency-service.js';
import { withMediaGenerationProjectSession } from './project-session.js';
import { requireMediaGenerationPurposeDefinition } from './purpose-lifecycle-registry.js';
import {
  createMediaGenerationSpec,
  listMediaGenerationSpecs,
  prepareDraftMediaGenerationSpec,
  prepareMediaGenerationSpec,
  readMediaGenerationSpec,
  updateMediaGenerationSpec,
  validateMediaGenerationSpec,
} from './spec-service.js';
import {
  buildDraftMediaGenerationPreview,
  buildMediaGenerationPreview,
  updateGenerationPreviewSpec,
} from '../../generation-preview/service.js';

const mockedRequireSpec = vi.mocked(requireMediaGenerationSpec);
const mockedAssertDependencies = vi.mocked(assertRootDependenciesResolved);
const mockedWithProjectSession = vi.mocked(withMediaGenerationProjectSession);
const mockedRequireDefinition = vi.mocked(requireMediaGenerationPurposeDefinition);

describe('media generation lifecycle spec service', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockedWithProjectSession.mockImplementation(async (_input, fn) =>
      fn({ session: { kind: 'session' }, projectFolder: '/project' } as never)
    );
  });

  it('delegates validation, listing, and draft preparation to the purpose definition', async () => {
    const definition = {
      validateSpec: vi.fn(async () => ({ spec: { normalized: true } })),
      listSpecs: vi.fn(async () => ({ specs: [{ id: 'spec-a' }] })),
      prepareDraftSpec: vi.fn(async () => ({ generation: { mode: 'draft' } })),
    };
    mockedRequireDefinition.mockReturnValue(definition as never);

    await expect(
      validateMediaGenerationSpec({ spec: { purpose: 'lookbook.image' } } as never)
    ).resolves.toEqual({ spec: { normalized: true } });
    await expect(
      listMediaGenerationSpecs({
        purpose: 'lookbook.image',
        target: { kind: 'lookbook', id: 'lookbook-a' },
      } as never)
    ).resolves.toEqual({ specs: [{ id: 'spec-a' }] });
    await expect(
      prepareDraftMediaGenerationSpec({
        spec: { purpose: 'lookbook.image' },
      } as never)
    ).resolves.toEqual({ generation: { mode: 'draft' } });
  });

  it('checks root dependencies before create and update for dependency-owning purposes', async () => {
    const createSpec = vi.fn(async () => ({ id: 'created-spec' }));
    const updateSpec = vi.fn(async () => ({ id: 'updated-spec' }));
    mockedRequireDefinition.mockReturnValue({
      declareDependencies: vi.fn(),
      createSpec,
      updateSpec,
    } as never);

    await expect(
      createMediaGenerationSpec({ spec: { purpose: 'shot.video-take' } } as never)
    ).resolves.toEqual({ id: 'created-spec' });
    await expect(
      updateMediaGenerationSpec({ spec: { purpose: 'shot.video-take' } } as never)
    ).resolves.toEqual({ id: 'updated-spec' });

    expect(mockedAssertDependencies).toHaveBeenCalledTimes(2);
    expect(createSpec).toHaveBeenCalledTimes(1);
    expect(updateSpec).toHaveBeenCalledTimes(1);
  });

  it('does not check dependencies for purposes that declare none', async () => {
    const createSpec = vi.fn(async () => ({ id: 'created-spec' }));
    mockedRequireDefinition.mockReturnValue({
      createSpec,
    } as never);

    await createMediaGenerationSpec({
      spec: { purpose: 'lookbook.image' },
    } as never);

    expect(mockedAssertDependencies).not.toHaveBeenCalled();
    expect(createSpec).toHaveBeenCalledTimes(1);
  });

  it('reads persisted specs through the media generation project session', async () => {
    mockedRequireSpec.mockReturnValueOnce({
      id: 'spec-a',
      purpose: 'lookbook.image',
      spec: { purpose: 'lookbook.image' },
    } as never);

    await expect(
      readMediaGenerationSpec({ specId: 'spec-a', homeDir: '/home' } as never)
    ).resolves.toMatchObject({
      id: 'spec-a',
      purpose: 'lookbook.image',
    });
    expect(mockedRequireSpec).toHaveBeenCalledWith(
      { kind: 'session' },
      'spec-a'
    );
  });

  it('prepares persisted specs through the purpose that owns the stored purpose id', async () => {
    const prepareSpec = vi.fn(async () => ({ generation: { policy: 'prepared' } }));
    mockedRequireSpec.mockReturnValueOnce({
      id: 'spec-a',
      purpose: 'lookbook.image',
      spec: { purpose: 'lookbook.image' },
    } as never);
    mockedRequireDefinition.mockReturnValueOnce({ prepareSpec } as never);

    await expect(
      prepareMediaGenerationSpec({ specId: 'spec-a', homeDir: '/home' } as never)
    ).resolves.toEqual({ generation: { policy: 'prepared' } });

    expect(prepareSpec).toHaveBeenCalledWith({
      specId: 'spec-a',
      homeDir: '/home',
    });
  });

  it('builds persisted generation previews through the purpose definition preview hook', async () => {
    const buildPreview = vi.fn(async () => ({
      kind: 'generationPreview',
      previewId: 'generation-preview:spec-a',
    }));
    mockedRequireSpec.mockReturnValueOnce({
      id: 'spec-a',
      purpose: 'lookbook.image',
      spec: { purpose: 'lookbook.image' },
    } as never);
    mockedRequireDefinition.mockReturnValueOnce({
      preview: { build: buildPreview },
    } as never);

    await expect(
      buildMediaGenerationPreview({ specId: 'spec-a', homeDir: '/home' })
    ).resolves.toMatchObject({
      kind: 'generationPreview',
      previewId: 'generation-preview:spec-a',
    });

    expect(buildPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        homeDir: '/home',
        specRecord: expect.objectContaining({
          id: 'spec-a',
          purpose: 'lookbook.image',
        }),
      })
    );
  });

  it('builds draft generation previews through the same purpose definition preview hook', async () => {
    const spec = {
      purpose: 'lookbook.image',
      target: { kind: 'lookbook', id: 'lookbook-a' },
      modelChoice: 'model-a',
      prompt: 'Paint the basilica.',
    };
    const normalizedSpec = {
      ...spec,
      prompt: 'Paint the basilica in rain.',
    };
    const validateSpec = vi.fn(async () => ({
      valid: true,
      spec: normalizedSpec,
      providerPayload: {},
    }));
    const buildPreview = vi.fn(async () => ({
      kind: 'generationPreview',
      previewId: 'generation-preview:draft:lookbook.image:lookbook:lookbook-a',
    }));
    mockedRequireDefinition.mockReturnValue({
      validateSpec,
      preview: { build: buildPreview },
    } as never);

    await expect(
      buildDraftMediaGenerationPreview({
        homeDir: '/home',
        spec,
      } as never)
    ).resolves.toMatchObject({
      kind: 'generationPreview',
      previewId: 'generation-preview:draft:lookbook.image:lookbook:lookbook-a',
    });

    expect(validateSpec).toHaveBeenCalledWith({
      homeDir: '/home',
      spec,
    });
    expect(buildPreview).toHaveBeenCalledWith(
      expect.objectContaining({
        homeDir: '/home',
        specRecord: expect.objectContaining({
          id: 'draft:lookbook.image:lookbook:lookbook-a',
          purpose: 'lookbook.image',
          spec: normalizedSpec,
        }),
      })
    );
    expect(mockedRequireSpec).not.toHaveBeenCalled();
  });

  it('fails generation previews with structured diagnostics when a purpose has no preview hook', async () => {
    mockedRequireSpec.mockReturnValueOnce({
      id: 'spec-a',
      purpose: 'cast.voice-sample',
      spec: { purpose: 'cast.voice-sample' },
    } as never);
    mockedRequireDefinition.mockReturnValueOnce({ prepareSpec: vi.fn() } as never);

    await expect(
      buildMediaGenerationPreview({ specId: 'spec-a' })
    ).rejects.toMatchObject({
      code: 'CORE_MEDIA_GENERATION_PREVIEW_PURPOSE_UNSUPPORTED',
    });
  });

  it('updates authored prompt text through the purpose and rebuilds the saved preview', async () => {
    const specRecord = {
      id: 'spec-a',
      purpose: 'lookbook.image',
      spec: {
        purpose: 'lookbook.image',
        target: { kind: 'lookbook', id: 'lookbook-a' },
        prompt: 'Original prompt.',
      },
    };
    const updateSpec = vi.fn(async (input) => ({
      ...specRecord,
      spec: input.spec,
    }));
    const buildPreview = vi.fn(async (input) => ({
      kind: 'generationPreview',
      previewId: `generation-preview:${input.specRecord.id}`,
      finalPrompt: {
        authoredText: input.specRecord.spec.prompt,
        providerText: input.specRecord.spec.prompt,
      },
    }));
    mockedRequireSpec.mockReturnValueOnce(specRecord as never);
    mockedRequireDefinition.mockReturnValueOnce({
      preview: {
        update: vi.fn(async (input) => updateSpec({
          projectName: input.projectName,
          homeDir: input.homeDir,
          specId: input.specRecord.id,
          spec: {
            ...input.specRecord.spec,
            prompt: input.prompt.authoredText,
          },
        })),
        build: buildPreview,
      },
    } as never);

    await expect(
      updateGenerationPreviewSpec({
        specId: 'spec-a',
        prompt: { authoredText: 'Updated opaque prompt.\nSecond line.' },
        referenceSelections: [],
      }),
    ).resolves.toMatchObject({
      finalPrompt: {
        authoredText: 'Updated opaque prompt.\nSecond line.',
      },
    });
    expect(updateSpec).toHaveBeenCalledWith(
      expect.objectContaining({
        specId: 'spec-a',
        spec: expect.objectContaining({
          prompt: 'Updated opaque prompt.\nSecond line.',
        }),
      }),
    );
    expect(buildPreview).toHaveBeenCalledTimes(1);
  });

  it('rejects reference updates when the purpose has no owning update hook', async () => {
    mockedRequireSpec.mockReturnValueOnce({
      id: 'spec-a',
      purpose: 'lookbook.image',
      spec: {
        purpose: 'lookbook.image',
        target: { kind: 'lookbook', id: 'lookbook-a' },
        prompt: 'Original prompt.',
      },
    } as never);
    mockedRequireDefinition.mockReturnValueOnce({
      preview: { build: vi.fn() },
    } as never);

    await expect(
      updateGenerationPreviewSpec({
        specId: 'spec-a',
        prompt: { authoredText: 'Updated prompt.' },
        referenceSelections: [
          { dependencyId: 'dependency-a', selected: false },
        ],
      }),
    ).rejects.toMatchObject({
      code: 'CORE_MEDIA_GENERATION_PREVIEW_UPDATE_UNSUPPORTED',
    });
  });
});
