import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { Screenplay, ScreenplayBlock } from '@gorenku/studio-core/client';
import { createProjectDataService } from '@gorenku/studio-core/server';
import { expect, test } from '../../fixtures/studio-e2e-test';
import {
  createImportedFdxMovieProject,
  type StudioE2eImportedFdxProject,
} from '../../fixtures/studio-e2e-screenplay-fdx';
import {
  cleanStudioE2eProject,
  createStudioE2eProjectName,
} from '../../fixtures/studio-e2e-project';

test('imports the full-length Big Fish stress fixture without editor-owned data', async ({
  studioE2eRuntime,
}, testInfo) => {
  const project = await createImportedFdxMovieProject({
    runtime: studioE2eRuntime,
    projectName: createStudioE2eProjectName({
      prefix: 'e2e-fdx-big-fish',
      workerIndex: testInfo.workerIndex,
      testIndex: testInfo.testId.length,
      title: testInfo.title,
    }),
    title: 'FDX Big Fish E2E',
    fixture: 'big-fish.fdx',
  });

  expect(project.importReport.counts).toEqual({
    scenes: 202,
    acts: 0,
    sequences: 0,
    blocks: 1655,
    dialogueTurns: 768,
    productionSceneNumbers: 202,
  });
  expect(project.screenplay.opening).toMatchObject([
    { type: 'action', text: 'FADE IN' },
  ]);
  expect(project.screenplay.scenes[0]).toMatchObject({
    productionNumber: '1',
    heading: 'A RIVER.',
  });
  expect(project.screenplay.scenes.at(-1)?.heading).toBe(
    'ext.  river / underwater - day'
  );
  expect(project.importReport.candidates.characterCues).toHaveLength(143);
  expectEveryCanonicalBlockHasVisibleText(project.screenplay);
  await expectExactRetainedSource({
    runtimeHome: studioE2eRuntime.isolatedHomeDirectory,
    project,
    titlePageOnlyText: 'Copyright © 2003 Columbia Pictures',
  });
  await cleanStudioE2eProject({ runtime: studioE2eRuntime, project });
});

test('imports Brick and Steel split runs, ordered dialogue, and wrapped Dual Dialogue', async ({
  studioE2eRuntime,
}, testInfo) => {
  const project = await createImportedFdxMovieProject({
    runtime: studioE2eRuntime,
    projectName: createStudioE2eProjectName({
      prefix: 'e2e-fdx-brick-steel',
      workerIndex: testInfo.workerIndex,
      testIndex: testInfo.testId.length,
      title: testInfo.title,
    }),
    title: 'FDX Brick And Steel E2E',
    fixture: 'brick-and-steel.fdx',
  });

  expect(project.importReport.counts).toEqual({
    scenes: 8,
    acts: 0,
    sequences: 0,
    blocks: 49,
    dialogueTurns: 20,
    productionSceneNumbers: 0,
  });
  const patio = requiredScene(project.screenplay, 'Ext. Brick’s patio - day');
  expect(patio.blocks[0]).toMatchObject({
    type: 'action',
    text: 'A gorgeous day.  The sun is shining.  But BRICK BRADDOCK, retired police detective, is sitting quietly, contemplating -- something.',
  });
  expect(patio.blocks.find((block) => block.type === 'dialogue'
    && block.characterName === 'STEEL'
    && block.extensions.includes('CONT’D'))).toMatchObject({
    parts: [
      { type: 'parenthetical', text: 'beer raised' },
      { type: 'speech', text: 'To retirement.' },
    ],
  });
  expect(patio.blocks.find((block) => block.type === 'dualDialogue')).toMatchObject({
    type: 'dualDialogue',
    left: { characterName: 'STEEL', parts: [{ text: 'Screw retirement.' }] },
    right: { characterName: 'BRICK', parts: [{ text: 'Screw retirement.' }] },
  });
  await expectExactRetainedSource({
    runtimeHome: studioE2eRuntime.isolatedHomeDirectory,
    project,
    titlePageOnlyText: '1588 Mission Dr.',
  });
  await cleanStudioE2eProject({ runtime: studioE2eRuntime, project });
});

test('imports The Last Birthday Card displayed inserts without inventing speakers', async ({
  studioE2eRuntime,
}, testInfo) => {
  const project = await createImportedFdxMovieProject({
    runtime: studioE2eRuntime,
    projectName: createStudioE2eProjectName({
      prefix: 'e2e-fdx-birthday-card',
      workerIndex: testInfo.workerIndex,
      testIndex: testInfo.testId.length,
      title: testInfo.title,
    }),
    title: 'FDX Last Birthday Card E2E',
    fixture: 'the-last-birthday-card.fdx',
  });

  expect(project.importReport.counts).toEqual({
    scenes: 49,
    acts: 0,
    sequences: 0,
    blocks: 287,
    dialogueTurns: 134,
    productionSceneNumbers: 0,
  });
  expect(project.screenplay.opening).toMatchObject([
    { type: 'transition', text: 'here we go:' },
  ]);
  const apartment = requiredScene(
    project.screenplay,
    'back in the apartment'
  );
  expect(apartment.blocks).toContainEqual(expect.objectContaining({
    type: 'action',
    text: '\nScott --\n\nJacob Billups\nPalace Hotel, RM 412\n1:00 pm tomorrow',
  }));
  expect(apartment.blocks.some((block) => block.type === 'dialogue')).toBe(false);
  await expectExactRetainedSource({
    runtimeHome: studioE2eRuntime.isolatedHomeDirectory,
    project,
    titlePageOnlyText: 'PO Box 10031',
  });
  await cleanStudioE2eProject({ runtime: studioE2eRuntime, project });
});

async function expectExactRetainedSource(input: {
  runtimeHome: string;
  project: StudioE2eImportedFdxProject;
  titlePageOnlyText: string;
}): Promise<void> {
  const sha256 = createHash('sha256').update(input.project.sourceBytes).digest('hex');
  expect(input.project.importReport.screenplayImport.sha256).toBe(sha256);
  const retainedPath = path.join(
    input.project.projectPath,
    'screenplay',
    'sources',
    `${sha256}.fdx`
  );
  await expect(fs.readFile(retainedPath)).resolves.toEqual(input.project.sourceBytes);

  const assets = await createProjectDataService().listAssets({
    projectName: input.project.projectName,
    homeDir: input.runtimeHome,
    owner: { kind: 'project' },
  });
  expect(assets).toContainEqual(expect.objectContaining({
    id: input.project.importReport.screenplayImport.sourceAssetId,
    type: 'screenplay_source',
    mediaKind: 'document',
    files: [expect.objectContaining({
      id: input.project.importReport.screenplayImport.sourceAssetFileId,
      role: 'source',
      contentHash: sha256,
      mimeType: 'application/xml',
    })],
  }));

  const canonical = JSON.stringify(input.project.screenplay);
  const report = JSON.stringify(input.project.importReport);
  const source = input.project.sourceBytes.toString('utf8');
  expect(source).toContain('<TitlePage>');
  expect(source).toContain('<PageLayout');
  expect(source).toContain('<SmartType>');
  expect(source).toContain('<ElementSettings');
  expect(source).toContain('AdornmentStyle=');
  expect(source).toContain(input.titlePageOnlyText);
  expect(canonical).not.toContain(input.titlePageOnlyText);
  expect(canonical).not.toContain('AdornmentStyle');
  expect(canonical).not.toContain('Courier Final Draft');
  expect(canonical).not.toContain('SceneProperties');
  expect(canonical).not.toContain('HeaderAndFooter');
  expect(report).not.toContain('technicalLog');
  expect(report).not.toContain('ScriptNote');
  expect(report).not.toContain('TitlePage');
}

function requiredScene(screenplay: Screenplay, heading: string) {
  const scene = screenplay.scenes.find((candidate) => candidate.heading === heading);
  expect(scene, `missing imported Scene ${heading}`).toBeDefined();
  return scene!;
}

function expectEveryCanonicalBlockHasVisibleText(screenplay: Screenplay): void {
  for (const block of screenplay.scenes.flatMap((scene) => scene.blocks)) {
    for (const text of blockText(block)) {
      expect(text.trim()).not.toBe('');
    }
  }
}

function blockText(block: ScreenplayBlock): string[] {
  if (block.type === 'dualDialogue') {
    return [
      ...block.left.parts.map((part) => part.text),
      ...block.right.parts.map((part) => part.text),
    ];
  }
  if (block.type === 'dialogue') {
    return block.parts.map((part) => part.text);
  }
  return [block.text];
}
