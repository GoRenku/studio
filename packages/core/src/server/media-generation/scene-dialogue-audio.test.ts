import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { beforeEach, describe, expect, it } from 'vitest';
import type {
  CastVoiceAttachmentDocument,
  ProjectRelativePath,
} from '../../client/index.js';
import type { ScreenplayCreateDocument } from '../../client/screenplay.js';
import {
  createDeterministicIdGenerator,
  createProjectDataService,
  type ProjectDataService,
} from '../index.js';
import {
  createBlankMovieProject,
  writeConfig,
} from '../testing/project-data-fixtures.js';

describe('Scene Dialogue Audio generation', () => {
  let homeDir: string;
  let projectData: ProjectDataService;
  let projectPath: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-scene-dialogue-audio-test-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));

    projectData = createProjectDataService();
    const created = await createBlankMovieProject({
      projectData,
      homeDir,
      projectName: 'dialogue-audio-test',
      title: 'Dialogue Audio Test',
    });
    if (!created) {
      return;
    }
    projectPath = created.projectPath;
    await projectData.openCurrentProject({
      projectName: 'dialogue-audio-test',
      homeDir,
    });
    await projectData.applyCastOperations({
      homeDir,
      document: {
        kind: 'castOperations',
        operations: [
          {
            operation: 'castMember.add',
            castMember: {
              key: 'urban',
              handle: 'urban',
              name: 'Urban',
              role: 'cannon founder',
            },
          },
        ],
      },
      idGenerator: createDeterministicIdGenerator(),
    });
    await projectData.createScreenplay({
      homeDir,
      document: screenplayDocument(),
      idGenerator: createDeterministicIdGenerator(),
    });
  });

  it('creates and picks a simulated audio take from the shared generation runner output', async () => {
    await writeProjectFile('generated/audio/urban-sample.mp3', 'voice sample bytes');
    const attached = await projectData.attachCastVoice({
      projectName: 'dialogue-audio-test',
      homeDir,
      document: castVoiceAttachment(),
      idGenerator: createDeterministicIdGenerator(),
    });
    const screenplay = await projectData.readScreenplay({ homeDir });
    const scene = screenplay.screenplay?.acts[0]?.sequences[0]?.scenes[0];
    const dialogue = scene?.blocks.find(
      (block) => block.type === 'dialogue'
    );
    if (
      !scene?.id ||
      !dialogue ||
      dialogue.type !== 'dialogue' ||
      !dialogue.dialogueId
    ) {
      throw new Error('Expected seeded scene dialogue.');
    }
    const sceneId = scene.id;
    const dialogueId = dialogue.dialogueId;

    const report = await projectData.generateSceneDialogueAudioTake({
      projectName: 'dialogue-audio-test',
      homeDir,
      sceneId,
      dialogueId,
      setup: {
        modelChoice: 'elevenlabs/eleven_v3',
        castVoiceId: attached.voice.id,
        plainText: dialogue.lines.join('\n'),
        v3Text: 'Bronze has no temper. [shouts] Men give it one.',
        voiceSettings: {
          stability: 0.5,
          similarityBoost: 0.75,
          useSpeakerBoost: true,
        },
        outputFormat: 'mp3_44100_128',
        languageCode: 'en',
      },
      simulate: true,
      idGenerator: createDeterministicIdGenerator(),
    });

    const audio = report.context.audioByDialogueId[dialogueId];
    expect(audio).toMatchObject({
      dialogueId,
      pickedTakeId: expect.any(String),
      v3Text: 'Bronze has no temper. [shouts] Men give it one.',
      takes: [
        expect.objectContaining({
          picked: true,
          modelChoice: 'elevenlabs/eleven_v3',
          providerTextSnapshot: 'Bronze has no temper. [shouts] Men give it one.',
        }),
      ],
    });
    expect(audio?.takes[0]?.assetFileId).toEqual(expect.any(String));
  });

  async function writeProjectFile(
    projectRelativePath: string,
    content: string
  ): Promise<void> {
    const absolutePath = path.join(projectPath, projectRelativePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, content, 'utf8');
  }
});

function screenplayDocument(): ScreenplayCreateDocument {
  return {
    kind: 'screenplayCreate',
    screenplay: {
      title: 'Dialogue Audio Test',
      logline: 'A founder tests a cannon and a conscience.',
    },
    cast: [],
    locations: [],
    acts: [
      {
        key: 'act-one',
        title: 'Act I',
        sequences: [
          {
            key: 'the-wall',
            title: 'The Wall',
            scenes: [
              {
                key: 'cannon-test',
                title: 'Cannon Test',
                setting: {
                  interiorExterior: 'EXT',
                  timeOfDay: 'DAWN',
                  locationIds: [],
                },
                blocks: [
                  {
                    dialogueId: 'dialogue_urban_test',
                    type: 'dialogue',
                    castMemberId: 'cast_test0001',
                    lines: ['Bronze has no temper. Men give it one.'],
                  },
                ],
              },
            ],
          },
        ],
      },
    ],
  };
}

function castVoiceAttachment(): CastVoiceAttachmentDocument {
  return {
    kind: 'castVoiceAttachment',
    castMemberId: 'cast_test0001',
    name: 'urban-primary',
    provider: 'elevenlabs',
    model: 'eleven_v3',
    voiceId: 'voice_urban_primary',
    purpose: 'Primary speaking voice for Urban dialogue tests',
    sample: {
      sourceProjectRelativePath:
        'generated/audio/urban-sample.mp3' as ProjectRelativePath,
      title: 'Urban primary voice sample',
    },
  };
}
