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
import { runStudioE2eFdxImport } from '../../fixtures/studio-e2e-cli';
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
  await expect(runStudioE2eFdxImport({
    runtime: studioE2eRuntime,
    projectName: project.projectName,
    sourcePath: project.sourcePath,
  })).resolves.toMatchObject({ status: 'unchanged', resourceKeys: [] });
  const unchanged = await createProjectDataService().readScreenplayStructure({
    projectName: project.projectName,
    homeDir: studioE2eRuntime.isolatedHomeDirectory,
  });
  expect(unchanged.screenplay.sections).toEqual([]);
  expect(unchanged.screenplay.scenes).toHaveLength(202);
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

test('refreshes marker-heavy FDX as a flat read-only Scene tree', async ({
  page,
  studioE2eRuntime,
  minimalMovieProject,
}) => {
  const sourcePath = path.join(
    studioE2eRuntime.isolatedHomeDirectory,
    `${minimalMovieProject.projectName}.fdx`
  );
  await fs.writeFile(sourcePath, markerRefreshFdx([
    ['INT. FIRST ROOM - DAY', 'First action.'],
    ['INT. SECOND ROOM - DAY', 'Second action.'],
  ]), 'utf8');

  const imported = await runStudioE2eFdxImport({
    runtime: studioE2eRuntime,
    projectName: minimalMovieProject.projectName,
    sourcePath,
  });
  expect(imported.status).toBe('imported');
  const projectData = createProjectDataService();
  const initial = await projectData.readScreenplayStructure({
    projectName: minimalMovieProject.projectName,
    homeDir: studioE2eRuntime.isolatedHomeDirectory,
  });
  expect(initial.screenplay.sections).toEqual([]);
  expect(initial.screenplay.structure.every((entry) =>
    entry.parentSectionId === undefined && entry.content.type === 'scene'
  )).toBe(true);

  await page.goto(sceneRoute(
    minimalMovieProject.projectName,
    initial.screenplay.scenes[0]!.id
  ));
  const expandScreenplay = page.getByRole('button', { name: 'Expand Screenplay' });
  if (await expandScreenplay.isVisible()) {
    await expandScreenplay.click();
  }
  await expect(page.getByRole('button', { name: /INT\. FIRST ROOM - DAY/ }))
    .toHaveCount(1);
  await expect(page.getByRole('button', { name: /INT\. SECOND ROOM - DAY/ }))
    .toHaveCount(1);
  await expect(page.getByText('ACT ONE', { exact: true })).toHaveCount(0);
  await expect(page.getByText('CUSTOM OUTLINE', { exact: true })).toHaveCount(0);

  const unchanged = await runStudioE2eFdxImport({
    runtime: studioE2eRuntime,
    projectName: minimalMovieProject.projectName,
    sourcePath,
  });
  expect(unchanged).toMatchObject({ status: 'unchanged', resourceKeys: [] });
  await page.reload();
  await expect(page.getByRole('button', { name: /INT\. FIRST ROOM - DAY/ }))
    .toHaveCount(1);

  await fs.writeFile(sourcePath, markerRefreshFdx([
    ['INT. SECOND ROOM - DAY', 'Second action changed.'],
  ], 'ACT TWO', 'RENAMED OUTLINE'), 'utf8');
  const refreshed = await runStudioE2eFdxImport({
    runtime: studioE2eRuntime,
    projectName: minimalMovieProject.projectName,
    sourcePath,
  });
  expect(refreshed.status).toBe('refreshed');
  const changed = await projectData.readScreenplayStructure({
    projectName: minimalMovieProject.projectName,
    homeDir: studioE2eRuntime.isolatedHomeDirectory,
  });
  await page.goto(sceneRoute(
    minimalMovieProject.projectName,
    changed.screenplay.scenes[0]!.id
  ));
  const changedExpandScreenplay = page.getByRole('button', { name: 'Expand Screenplay' });
  if (await changedExpandScreenplay.isVisible()) {
    await changedExpandScreenplay.click();
  }
  await expect(page.getByRole('button', { name: /INT\. FIRST ROOM - DAY/ }))
    .toHaveCount(0);
  await expect(page.getByRole('button', { name: /INT\. SECOND ROOM - DAY/ }))
    .toHaveCount(1);
  await expect(page.getByText('Second action changed.', { exact: true }))
    .toBeVisible();
  await expect(page.getByText('ACT TWO', { exact: true })).toHaveCount(0);
  await expect(page.getByText('RENAMED OUTLINE', { exact: true })).toHaveCount(0);
});

async function expectExactRetainedSource(input: {
  runtimeHome: string;
  project: StudioE2eImportedFdxProject;
  titlePageOnlyText: string;
}): Promise<void> {
  const sha256 = createHash('sha256').update(input.project.sourceBytes).digest('hex');
  expect(input.project.importReport.screenplayImport.sha256).toBe(sha256);
  const assets = await createProjectDataService().listAssets({
    projectName: input.project.projectName,
    homeDir: input.runtimeHome,
    owner: { kind: 'project' },
  });
  const sourceAsset = assets.find((asset) =>
    asset.id === input.project.importReport.screenplayImport.sourceAssetId
  );
  expect(sourceAsset).toEqual(expect.objectContaining({
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
  const sourceFile = sourceAsset?.files.find((file) =>
    file.id === input.project.importReport.screenplayImport.sourceAssetFileId
  );
  if (!sourceFile) {
    throw new Error('Expected the retained FDX source Asset File.');
  }
  const retainedPath = path.join(
    input.project.projectPath,
    sourceFile.projectRelativePath
  );
  await expect(fs.readFile(retainedPath)).resolves.toEqual(input.project.sourceBytes);

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

function sceneRoute(projectName: string, sceneId: string): string {
  return `/projects/${encodeURIComponent(projectName)}/scenes/${encodeURIComponent(sceneId)}`;
}

function markerRefreshFdx(
  scenes: Array<[string, string]>,
  act = 'ACT ONE',
  outline = 'CUSTOM OUTLINE'
): string {
  return '<FinalDraft DocumentType="Script"><Content>'
    + `<Paragraph Type="New Act"><Text>${act}</Text></Paragraph>`
    + `<Paragraph Type="Outline 1"><Text>${outline}</Text></Paragraph>`
    + '<Paragraph Type="Sequence"><Text>SEQUENCE A</Text></Paragraph>'
    + scenes.map(([heading, action]) =>
      `<Paragraph Type="Scene Heading"><Text>${heading}</Text></Paragraph>`
      + `<Paragraph Type="Action"><Text>${action}</Text></Paragraph>`
    ).join('')
    + '<Paragraph Type="End of Act"><Text>END OF ACT</Text></Paragraph>'
    + '</Content></FinalDraft>';
}
