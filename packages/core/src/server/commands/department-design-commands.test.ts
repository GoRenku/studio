import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type {
  CastDesignDocument,
  LocationDesignDocument,
} from '../../client/department-design.js';
import type { ProjectRelativePath } from '../../client/project.js';
import {
  createProjectDataService,
} from '../index.js';
import {
  createBlankMovieProject,
  createSampleMovieProject,
  writeConfig,
} from '../testing/project-data-fixtures.js';
import { createTestAssetFixture } from '../testing/asset-fixture-helpers.js';

describe('department design commands', () => {
  let homeDir: string;
  let projectData = createProjectDataService();

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-department-command-test-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
    projectData = createProjectDataService();
  });

  it('applies cast and location fact operations through canonical command surfaces', async () => {
    await createBlankMovieProject({ homeDir, projectData });
    await projectData.openCurrentProject({ projectName: 'blank-movie', homeDir });

    const castDryRun = await projectData.applyCastOperations({
      homeDir,
      dryRun: true,
      document: {
        kind: 'castOperations',
        operations: [
          {
            operation: 'castMember.add',
            castMember: {
              key: 'ada',
              handle: 'ada',
              name: 'Ada',
              role: 'protagonist',
            },
          },
        ],
      },
    });
    expect(castDryRun.resourceKeys).toEqual(
      expect.arrayContaining(['navigation:cast'])
    );
    expect(await projectData.listCastMembers({ homeDir })).toHaveLength(0);

    const castReport = await projectData.applyCastOperations({
      homeDir,
      document: {
        kind: 'castOperations',
        operations: [
          {
            operation: 'castMember.add',
            castMember: {
              key: 'ada',
              handle: 'ada',
              name: 'Ada',
              role: 'protagonist',
            },
          },
        ],
      },
    });
    const castMemberId = castReport.generatedIds?.[0]?.id;
    expect(castMemberId).toBeTruthy();
    await expect(
      projectData.readCastMember({ homeDir, castMemberId: castMemberId as string })
    ).resolves.toMatchObject({ handle: 'ada', name: 'Ada' });

    const locationReport = await projectData.applyLocationOperations({
      homeDir,
      document: {
        kind: 'locationOperations',
        operations: [
          {
            operation: 'location.add',
            location: {
              key: 'control-room',
              handle: 'control-room',
              name: 'Control Room',
            },
          },
        ],
      },
    });
    const locationId = locationReport.generatedIds?.[0]?.id;
    await expect(
      projectData.readLocation({ homeDir, locationId: locationId as string })
    ).resolves.toMatchObject({ handle: 'control-room', name: 'Control Room' });
  });

  it('writes Cast Design and Location Design documents', async () => {
    await createSampleMovieProject({ homeDir, projectData });

    const screenplay = await projectData.readScreenplay({ homeDir });
    const castMemberId = screenplay.screenplay?.cast[1]?.id as string;
    const locationId = screenplay.screenplay?.locations[0]?.id as string;
    const sceneId = screenplay.screenplay?.acts[0]?.sequences[0]?.scenes[0]?.id as string;

    const castDesign = castDesignDocument(castMemberId, sceneId);
    const castWrite = await projectData.writeCastDesign({
      homeDir,
      document: castDesign,
    });
    expect(castWrite.activeDesignId).toBe(castWrite.designId);
    expect(castWrite.resourceKeys).toEqual([
      'navigation:cast',
      `surface:castMember:${castMemberId}`,
    ]);
    await expect(
      projectData.readCastContext({ homeDir, castMemberId })
    ).resolves.toMatchObject({
      activeDesignSummary: {
        castMemberId,
        voiceCasting: 'Measured young sovereign voice',
      },
    });

    const locationDesign = locationDesignDocument(locationId);
    const locationWrite = await projectData.writeLocationDesign({
      homeDir,
      document: locationDesign,
    });
    expect(locationWrite.activeDesignId).toBe(locationWrite.designId);
    expect(locationWrite.resourceKeys).toEqual([
      'navigation:locations',
      `surface:location:${locationId}`,
    ]);
    await expect(
      projectData.readLocationContext({ homeDir, locationId })
    ).resolves.toMatchObject({
      activeDesignSummary: {
        locationId,
        spatialThesis: 'Ceremony squeezed into a tactical planning room.',
      },
    });
  });

  it('reports voice-over cast members as profile-ready without requiring character sheets', async () => {
    await createSampleMovieProject({ homeDir, projectData });

    const screenplay = await projectData.readScreenplay({ homeDir });
    const narratorId = screenplay.screenplay?.cast.find(
      (castMember) => castMember.isVoiceOver
    )?.id as string;

    await expect(
      projectData.readCastContext({ homeDir, castMemberId: narratorId })
    ).resolves.toMatchObject({
      castMember: {
        id: narratorId,
        isVoiceOver: true,
      },
      generationReadiness: {
        characterSheet: false,
        profile: true,
        notes: expect.arrayContaining([
          'Voice-over Cast Members do not require visual character sheets.',
          'Use cast.profile for a symbolic navigation image only; it must not be treated as a physical character reference.',
          'Use Cast Voice records for durable voice identity and samples.',
        ]),
      },
    });
  });

  it('rejects cast member deletes when assets or Cast Designs depend on the member', async () => {
    const created = await createBlankMovieProject({ homeDir, projectData });
    if (!created) {
      return;
    }
    await projectData.openCurrentProject({ projectName: 'blank-movie', homeDir });

    const castReport = await projectData.applyCastOperations({
      homeDir,
      document: {
        kind: 'castOperations',
        operations: [
          {
            operation: 'castMember.add',
            castMember: {
              key: 'ada',
              handle: 'ada',
              name: 'Ada',
            },
          },
        ],
      },
    });
    const castMemberId = castReport.generatedIds?.[0]?.id as string;
    const assetPath = path.join(created.projectPath, 'ada-reference.txt');
    await fs.writeFile(assetPath, 'Ada visual reference.', 'utf8');
    await createTestAssetFixture({
      homeDir,
      projectName: 'blank-movie',
      target: { kind: 'castMember', castMemberId },
      projectRelativePath: 'ada-reference.txt' as ProjectRelativePath,
      type: 'reference',
      mediaKind: 'text',
      title: 'Ada reference',
      fileRole: 'source',
      role: 'character-sheet',
    });
    await projectData.writeCastDesign({
      homeDir,
      document: minimalCastDesignDocument(castMemberId),
    });

    await expect(
      projectData.applyCastOperations({
        homeDir,
        dryRun: true,
        document: {
          kind: 'castOperations',
          operations: [
            {
              operation: 'castMember.delete',
              castMemberId,
            },
          ],
        },
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA200',
      issues: [
        expect.objectContaining({
          code: 'PROJECT_DATA217',
          message: expect.stringContaining('Cast asset'),
        }),
      ],
    });
    await expect(projectData.readCastMember({ homeDir, castMemberId })).resolves.toMatchObject({
      id: castMemberId,
    });
  });

  it('rejects location deletes when assets or Location Designs depend on the location', async () => {
    const created = await createBlankMovieProject({ homeDir, projectData });
    if (!created) {
      return;
    }
    await projectData.openCurrentProject({ projectName: 'blank-movie', homeDir });

    const locationReport = await projectData.applyLocationOperations({
      homeDir,
      document: {
        kind: 'locationOperations',
        operations: [
          {
            operation: 'location.add',
            location: {
              key: 'workshop',
              handle: 'workshop',
              name: 'Workshop',
            },
          },
        ],
      },
    });
    const locationId = locationReport.generatedIds?.[0]?.id as string;
    const assetPath = path.join(created.projectPath, 'workshop-reference.txt');
    await fs.writeFile(assetPath, 'Workshop visual reference.', 'utf8');
    await createTestAssetFixture({
      homeDir,
      projectName: 'blank-movie',
      target: { kind: 'location', locationId },
      projectRelativePath: 'workshop-reference.txt' as ProjectRelativePath,
      type: 'reference',
      mediaKind: 'text',
      title: 'Workshop reference',
      fileRole: 'source',
      role: 'environment-sheet',
    });
    await projectData.writeLocationDesign({
      homeDir,
      document: locationDesignDocument(locationId),
    });

    await expect(
      projectData.applyLocationOperations({
        homeDir,
        dryRun: true,
        document: {
          kind: 'locationOperations',
          operations: [
            {
              operation: 'location.delete',
              locationId,
            },
          ],
        },
      })
    ).rejects.toMatchObject({
      code: 'PROJECT_DATA200',
      issues: [
        expect.objectContaining({
          code: 'PROJECT_DATA217',
          message: expect.stringContaining('Location asset'),
        }),
      ],
    });
    await expect(projectData.readLocation({ homeDir, locationId })).resolves.toMatchObject({
      id: locationId,
    });
  });

  it('rejects obsolete screenplay-routed cast and location mutations', async () => {
    await createSampleMovieProject({ homeDir, projectData });

    await expect(
      projectData.applyScreenplayOperations({
        homeDir,
        document: {
          kind: 'screenplayOperations',
          operations: [
            {
              operation: 'castMember.update',
              castMember: {
                id: 'cast_test0002',
                handle: 'mehmed-ii',
                name: 'Mehmed II',
              },
            },
          ],
        } as never,
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA200' });

    await expect(
      projectData.applyScreenplayOperations({
        homeDir,
        document: {
          kind: 'screenplayOperations',
          operations: [
            {
              operation: 'location.delete',
              locationId: 'location_test0001',
            },
          ],
        } as never,
      })
    ).rejects.toMatchObject({ code: 'PROJECT_DATA200' });
  });
});

function castDesignDocument(
  castMemberId: string,
  sceneId: string
): CastDesignDocument {
  return {
    kind: 'castDesign',
    castMemberId,
    title: 'Mehmed Casting Direction',
    design: {
      interpretation: {
        roleUnderstanding: 'A young ruler turning obsession into procedure.',
        audienceRead: ['Brilliant', 'contained', 'dangerously patient'],
        contradictions: ['Youthful face with old strategic appetite'],
      },
      appearance: {
        ageRead: 'early twenties',
        posture: 'upright and spare',
        movement: 'deliberate, never hurried',
      },
      performance: {
        behavioralPressure: ['Suppresses urgency'],
        stillness: ['Lets silence make others move first'],
        gesture: ['Small hand movements over maps'],
        statusShifts: ['Soft voice becomes command'],
        sceneEnergy: ['Quietly tightening'],
      },
      costume: {
        baseWardrobeLogic: ['Dark formal layers with restrained ornament'],
        variants: [
          {
            label: 'council-night',
            scope: { kind: 'scene', sceneId },
            wardrobe: ['Layered robe, minimal jewelry, dark sash'],
          },
        ],
      },
      voiceCasting: {
        voiceIdentity: 'Measured young sovereign voice',
        tempo: 'slow until challenged',
      },
      continuity: {
        mustRemainConsistent: ['Controlled posture', 'unhurried gaze'],
        canChange: ['Degree of visible fatigue'],
      },
      generationGuidance: {
        characterSheetPositive: ['young Ottoman ruler', 'controlled posture'],
        characterSheetNegative: ['cartoon crown', 'modern suit'],
        profilePositive: ['three-quarter portrait', 'restrained authority'],
        profileNegative: ['smiling glamour portrait'],
      },
    },
  };
}

function minimalCastDesignDocument(castMemberId: string): CastDesignDocument {
  return {
    kind: 'castDesign',
    castMemberId,
    title: 'Ada Casting Direction',
    design: {
      interpretation: {
        roleUnderstanding: 'A principled engineer holding the plan together.',
        audienceRead: ['precise', 'watchful'],
        contradictions: ['Warm intent under a reserved exterior'],
      },
      appearance: {
        ageRead: 'early thirties',
        posture: 'balanced and attentive',
        movement: 'economical',
      },
      performance: {
        behavioralPressure: ['Measures every response'],
        stillness: ['Pauses before difficult truths'],
        gesture: ['Small adjustments to tools and notes'],
        statusShifts: ['Quiet certainty becomes command'],
        sceneEnergy: ['Focused'],
      },
      costume: {
        baseWardrobeLogic: ['Functional layers with subtle formal detail'],
        variants: [],
      },
      voiceCasting: {
        voiceIdentity: 'Calm, observant, technically fluent voice',
      },
      continuity: {
        mustRemainConsistent: ['Economical movement', 'attentive listening'],
        canChange: ['Degree of visible fatigue'],
      },
      generationGuidance: {
        characterSheetPositive: ['engineer portrait', 'reserved authority'],
        characterSheetNegative: ['cartoon styling', 'modern tech office'],
        profilePositive: ['three-quarter portrait', 'workshop light'],
        profileNegative: ['fashion editorial'],
      },
    },
  };
}

function locationDesignDocument(locationId: string): LocationDesignDocument {
  return {
    kind: 'locationDesign',
    locationId,
    title: 'Council Chamber Production Design',
    design: {
      spatialThesis: 'Ceremony squeezed into a tactical planning room.',
      architecture: ['Low ceiling', 'deep window recesses'],
      setDressing: ['Maps pinned over older wall textiles'],
      materialsAndSurfaces: ['Dark wood', 'brass lamp glow'],
      atmosphere: ['Oil smoke', 'crowded silence'],
      propsAndRecurringObjects: [
        {
          name: 'city map',
          description: 'Large worn map weighted with brass markers.',
        },
      ],
      continuity: ['Map remains central to table geography'],
      environmentSheetGuidance: ['Show cramped room geometry and map table'],
      generationGuidance: ['Ottoman planning chamber', 'lamplit tactical room'],
    },
  };
}
