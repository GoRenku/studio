import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { createProjectDataService } from '@gorenku/studio-core/server';
import { beforeEach, describe, expect, it } from 'vitest';
import { runRenkuCli } from '../../src/cli.js';

describe('Scene Storyboard generation context CLI projection', () => {
  let homeDir: string;
  let stdout: string[];
  let stderr: string[];

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-cli-storyboard-context-'));
    stdout = [];
    stderr = [];
  });

  it('projects exact Scene Prop facts, reference candidates, and the Codex default from Core', async () => {
    const storageRoot = path.join(homeDir, 'movies');
    expect(await run(['init', storageRoot])).toBe(0);
    resetOutput();
    const createExitCode = await run([
      'create',
      'constantinople',
      '--title',
      'Preparation of the Siege',
    ]);
    if (isMissingSqliteBindings(createExitCode, stderr)) {
      return;
    }
    expect(createExitCode, stderr.join('\n')).toBe(0);

    const projectData = createProjectDataService();
    const cast = await projectData.applyCastOperations({
      homeDir,
      document: {
        kind: 'castOperations',
        operations: [{
          operation: 'castMember.add',
          castMember: { key: 'urban', handle: 'urban', name: 'Urban' },
        }],
      },
    });
    const locations = await projectData.applyLocationOperations({
      homeDir,
      document: {
        kind: 'locationOperations',
        operations: [{
          operation: 'location.add',
          location: { key: 'foundry', handle: 'foundry', name: 'Foundry' },
        }],
      },
    });
    const props = await projectData.applyPropOperations({
      homeDir,
      document: {
        kind: 'propOperations',
        operations: [
          {
            operation: 'prop.add',
            prop: { key: 'bronze-seal', handle: 'bronze-seal', name: 'Bronze Seal' },
          },
          {
            operation: 'prop.add',
            prop: { key: 'unrelated-banner', handle: 'unrelated-banner', name: 'Unrelated Banner' },
          },
        ],
      },
    });
    const castMemberId = cast.generatedIds![0]!.id;
    const locationId = locations.generatedIds![0]!.id;
    const propId = props.generatedIds![0]!.id;
    const unrelatedPropId = props.generatedIds![1]!.id;
    const screenplay = await projectData.createScreenplay({
      projectName: 'constantinople',
      homeDir,
      screenplay: screenplayDocument({ castMemberId, locationId, propId }),
    });
    const screenplayResource = await projectData.readScreenplayStructure({
      projectName: 'constantinople',
      homeDir,
    });
    const scene = screenplayResource.screenplay.scenes[0]!;
    const revision = await projectData.createSceneBeatsRevision({
      homeDir,
      document: {
        sceneId: scene.id!,
        beats: [{
          title: 'The seal commits the choice',
          description: 'Urban presses the bronze seal onto the map.',
          narrativeDevelopment: 'The plan becomes an irrevocable command.',
          narrativePurpose: 'Turn private intent into visible commitment.',
          castMemberIds: [castMemberId],
          locationIds: [locationId],
          propIds: [propId],
          screenplayBlockIds: [scene.blocks[0]!.id],
        }],
      },
    });
    expect(screenplay.screenplayRevisionId).toBeTruthy();

    const lookbookPath = path.join(homeDir, 'storyboard-lookbook.json');
    await fs.writeFile(lookbookPath, JSON.stringify(storyboardLookbookDocument(), null, 2), 'utf8');
    resetOutput();
    expect(await run(['lookbook', 'apply', '--file', lookbookPath, '--json'])).toBe(0);
    const lookbookId = JSON.parse(stdout.join('\n')).lookbook.id as string;

    const projectFolder = path.join(storageRoot, 'constantinople');
    await importPurposeMedia({
      projectFolder,
      projectRelativePath: 'generated/media/storyboard-lookbook.png',
      purpose: 'lookbook.storyboard-sheet',
      target: `lookbook:${lookbookId}`,
      title: 'Storyboard Lookbook Sheet',
    });
    const propSheet = await importPurposeMedia({
      projectFolder,
      projectRelativePath: 'generated/media/bronze-seal-sheet.png',
      purpose: 'prop.sheet',
      target: `prop:${propId}`,
      title: 'Bronze Seal Sheet',
    });
    const unrelatedPropSheet = await importPurposeMedia({
      projectFolder,
      projectRelativePath: 'generated/media/unrelated-banner-sheet.png',
      purpose: 'prop.sheet',
      target: `prop:${unrelatedPropId}`,
      title: 'Unrelated Banner Sheet',
    });

    resetOutput();
    const contextExitCode = await run([
      'generation',
      'context',
      '--purpose',
      'scene.storyboard-sheet',
      '--target',
      `scene:${scene.id}`,
      '--revision',
      revision.activeRevisionId,
      '--json',
    ]);
    expect(contextExitCode, stderr.join('\n')).toBe(0);
    const context = JSON.parse(stdout.join('\n'));

    expect(context.facts.scenePropIds).toEqual([propId]);
    expect(context.settings).toEqual({
      fixed: [{ kind: 'quality', value: 'high' }],
      recommended: [],
    });
    expect(context.workflowPolicy).toMatchObject({
      preferredExecutionPath: 'codex-built-in',
      codexBuiltIn: {
        applicable: true,
        executionKind: 'agent-external',
        capability: 'codex.gpt-image-2',
      },
    });
    const visualLanguage = context.referenceGuide.sections.find(
      (section: { id: string }) => section.id === 'visual-language'
    );
    const propSection = context.referenceGuide.sections.find(
      (section: { id: string }) => section.id === 'prop'
    );
    expect(visualLanguage.slots[0]).toMatchObject({
      id: 'storyboard-lookbook-sheet',
      eligibleCandidates: [expect.objectContaining({ reference: expect.any(Object) })],
    });
    expect(propSection.slots).toEqual([
      expect.objectContaining({
        id: 'prop-sheet',
        subject: { kind: 'prop', id: propId },
        eligibleCandidates: [
          expect.objectContaining({
            reference: {
              kind: 'asset-file',
              assetId: propSheet.asset.id,
              assetFileId: propSheet.asset.files[0]!.id,
            },
          }),
        ],
      }),
    ]);
    expect(JSON.stringify(context)).not.toContain(unrelatedPropSheet.asset.id);
    expect(stderr).toEqual([]);
  });

  async function run(args: string[]): Promise<number> {
    return await runRenkuCli(args, { homeDir, io: captureIo(stdout, stderr) });
  }

  async function importPurposeMedia(input: {
    projectFolder: string;
    projectRelativePath: string;
    purpose: 'lookbook.storyboard-sheet' | 'prop.sheet';
    target: string;
    title: string;
  }): Promise<{ asset: { id: string; files: Array<{ id: string }> } }> {
    const absolutePath = path.join(input.projectFolder, input.projectRelativePath);
    await fs.mkdir(path.dirname(absolutePath), { recursive: true });
    await fs.writeFile(absolutePath, 'fixture image bytes');
    resetOutput();
    const exitCode = await run([
      'media',
      'import',
      '--purpose',
      input.purpose,
      '--target',
      input.target,
      '--source',
      input.projectRelativePath,
      '--title',
      input.title,
      '--json',
    ]);
    expect(exitCode, stderr.join('\n')).toBe(0);
    return JSON.parse(stdout.join('\n'));
  }

  function resetOutput(): void {
    stdout = [];
    stderr = [];
  }
});

function screenplayDocument(input: {
  castMemberId: string;
  locationId: string;
  propId: string;
}) {
  return {
    opening: [],
    scenes: [{
      key: 'first-scene',
      heading: 'INT. FOUNDRY - NIGHT',
      title: 'The Commission',
      blocks: [{
        key: 'first-action',
        type: 'action' as const,
        text: 'Urban presses the bronze seal onto the map.',
      }],
    }],
    sections: [],
    structure: [{
      key: 'first-scene-entry',
      content: { type: 'scene' as const, scene: { key: 'first-scene' } },
      position: 0,
    }],
    references: [
      {
        key: 'first-scene-cast',
        subject: { type: 'castMember' as const, id: input.castMemberId },
        target: { type: 'scene' as const, scene: { key: 'first-scene' } },
        role: 'presence' as const,
      },
      {
        key: 'first-scene-location',
        subject: { type: 'location' as const, id: input.locationId },
        target: { type: 'scene' as const, scene: { key: 'first-scene' } },
        role: 'setting' as const,
      },
      {
        key: 'first-scene-prop',
        subject: { type: 'prop' as const, id: input.propId },
        target: { type: 'scene' as const, scene: { key: 'first-scene' } },
        role: 'presence' as const,
      },
    ],
  };
}

function storyboardLookbookDocument() {
  return {
    kind: 'storyboardLookbook',
    storyboardLookbook: {
      name: 'Naturalistic Storyboard',
      styleBrief: { text: 'Naturalistic, production-neutral story visualization.' },
      lineAndFinish: { text: 'Continuous tonal forms without visible linework.' },
      valueAndAccent: { text: 'Full color with restrained contrast.' },
      guardrails: { text: 'Keep action and geography immediately legible.' },
    },
    sourceInspirationFolderIds: [],
  };
}

function captureIo(stdout: string[], stderr: string[]) {
  return {
    stdout: { log(message: string) { stdout.push(message); } },
    stderr: { error(message: string) { stderr.push(message); } },
  };
}

function isMissingSqliteBindings(exitCode: number, stderr: string[]): boolean {
  return exitCode === 1 && stderr.some((line) =>
    line.includes('Could not locate the bindings file')
  );
}
