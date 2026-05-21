import { describe, expect, it } from 'vitest';
import { validateProjectSetup } from './reader.js';

describe('project setup reader', () => {
  it('collects setup errors and unknown-field warnings together', () => {
    const validation = validateProjectSetup({
      kind: 'renku.projectSetup',
      version: '0.1.0',
      project: {
        nam: 'constantinople',
        title: 'Preparation of the Siege',
      },
    });

    expect(validation.setup).toBeNull();
    expect(validation.result.valid).toBe(false);
    expect(validation.result.errors).toEqual([
      expect.objectContaining({
        code: 'PROJECT_SETUP003',
        message: 'project.name is required.',
      }),
      expect.objectContaining({
        code: 'PROJECT_SETUP003',
        message: 'project.type is required.',
      }),
    ]);
    expect(validation.result.warnings).toEqual([
      expect.objectContaining({
        code: 'PROJECT_SETUP100',
        location: expect.objectContaining({ path: ['project', 'nam'] }),
      }),
    ]);
  });

  it('accepts blank standalone project setup', () => {
    const validation = validateProjectSetup({
      kind: 'renku.projectSetup',
      version: '0.1.0',
      project: {
        name: 'blank-movie',
        title: 'Blank Movie',
        type: 'standaloneMovie',
      },
    });

    expect(validation.result.valid).toBe(true);
    expect(validation.setup).toMatchObject({
      project: {
        name: 'blank-movie',
        title: 'Blank Movie',
        type: 'standaloneMovie',
      },
    });
  });

  it('accepts unified inline and file-backed screenplay fields', () => {
    const validation = validateProjectSetup({
      kind: 'renku.projectSetup',
      version: '0.1.0',
      project: {
        name: 'constantinople',
        title: 'Preparation of the Siege',
        type: 'standaloneMovie',
        coverFile: 'screenplay/cover.png',
        summaryFile: 'screenplay/project-summary.md',
      },
      visualLanguage: [
        {
          category: 'Lighting',
          name: 'Low-key interiors',
          priority: 'default',
          guidance: 'Use practical light sources.',
          promptFile: 'screenplay/prompt.md',
        },
      ],
      cast: [
        {
          name: 'Narrator',
          descriptionFile: 'screenplay/narrator.md',
        },
      ],
      continuityReferences: [
        {
          kind: 'location',
          name: 'Theodosian Walls',
          description: 'Massive layered defenses.',
        },
      ],
      sequences: [
        {
          title: 'Opening',
          summaryFile: 'screenplay/opening.md',
          scenes: [
            {
              title: 'First Scene',
              summaryFile: 'screenplay/scene.md',
              clips: [
                {
                  title: 'First Clip',
                  summaryFile: 'screenplay/clip.md',
                  visualIntentFile: 'screenplay/visual-intent.md',
                },
              ],
            },
          ],
        },
      ],
    });

    expect(validation.result.valid).toBe(true);
    expect(validation.setup).toMatchObject({
      project: {
        coverFile: 'screenplay/cover.png',
        summaryFile: 'screenplay/project-summary.md',
      },
      visualLanguage: [
        expect.objectContaining({
          guidance: 'Use practical light sources.',
          promptFile: 'screenplay/prompt.md',
        }),
      ],
    });
  });

  it('rejects text and file values for the same field', () => {
    const validation = validateProjectSetup({
      kind: 'renku.projectSetup',
      version: '0.1.0',
      project: {
        name: 'constantinople',
        title: 'Preparation of the Siege',
        type: 'standaloneMovie',
        summary: 'Inline summary.',
        summaryFile: 'screenplay/project-summary.md',
      },
    });

    expect(validation.setup).toBeNull();
    expect(validation.result.errors).toEqual([
      expect.objectContaining({
        code: 'PROJECT_SETUP008',
        location: expect.objectContaining({
          path: ['project', 'summaryFile'],
        }),
      }),
    ]);
  });

  it('rejects screenplay containers that do not match project type', () => {
    const seriesValidation = validateProjectSetup({
      kind: 'renku.projectSetup',
      version: '0.1.0',
      project: {
        name: 'constantinople-series',
        title: 'Constantinople Series',
        type: 'series',
      },
      sequences: [{ title: 'Top-level Sequence' }],
    });
    const standaloneValidation = validateProjectSetup({
      kind: 'renku.projectSetup',
      version: '0.1.0',
      project: {
        name: 'constantinople',
        title: 'Constantinople',
        type: 'standaloneMovie',
      },
      episodes: [{ title: 'Episode 1' }],
    });

    expect(seriesValidation.result.errors).toEqual([
      expect.objectContaining({ code: 'PROJECT_SETUP011' }),
    ]);
    expect(standaloneValidation.result.errors).toEqual([
      expect.objectContaining({ code: 'PROJECT_SETUP012' }),
    ]);
  });
});
