import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import type {
  Scene,
  ScreenplayOperation,
} from '../../src/client/screenplay/index.js';
import type {
  ScreenplayAnalysis,
  ScreenplayAnalysisActRole,
  ScreenplayAnalysisCritique,
} from '../../src/client/screenplay-analysis/index.js';
import { beforeEach, describe, expect, it } from 'vitest';
import { createProjectDataService } from '../../src/server/index.js';
import { openProjectSession } from '../../src/server/database/lifecycle/active-session.js';
import {
  createProjectAssetFileWriteSet,
  rollbackProjectAssetFileWriteSetSync,
} from '../../src/server/project-asset-files/index.js';
import { persistFdxSourceAsset } from '../../src/server/screenplay/fdx/persistence/source-asset.js';
import { readFdxSource } from '../../src/server/screenplay/fdx/source.js';
import {
  createBlankMovieProject,
  writeConfig,
} from '../../src/server/testing/project-data-fixtures.js';

describe('source-authoritative FDX refresh', () => {
  let homeDir: string;
  let sourcePath: string;
  const projectData = createProjectDataService();

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-fdx-refresh-integration-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
    sourcePath = path.join(homeDir, 'source.fdx');
  });

  it('imports marker-heavy FDX flat, no-ops exact bytes, and treats marker-only edits as source-only refreshes', async () => {
    const projectName = await createProject('fdx-markers');
    await fs.writeFile(sourcePath, markerFdx('ACT ONE', 'CUSTOM OUTLINE'), 'utf8');

    const imported = await projectData.importFdxScreenplay({ projectName, homeDir, sourcePath });
    const initial = await projectData.readScreenplayStructure({ projectName, homeDir });
    const initialRevisions = await projectData.listScreenplayRevisions({ projectName, homeDir });
    const initialAssets = await projectData.listAssets({
      projectName,
      homeDir,
      owner: { kind: 'project' },
    });

    expect(imported).toMatchObject({
      status: 'imported',
      counts: { scenes: 3, blocks: 3, dialogueTurns: 0, productionSceneNumbers: 3 },
      resourceKeys: expect.any(Array),
    });
    expect(imported).not.toHaveProperty('operation');
    expect(imported).not.toHaveProperty('changes');
    expect(imported.counts).not.toHaveProperty('acts');
    expect(imported.counts).not.toHaveProperty('sequences');
    expect(initial.screenplay.sections).toEqual([]);
    expect(initial.screenplay.structure).toEqual(initial.screenplay.scenes.map((scene, position) => ({
      id: expect.any(String),
      content: { type: 'scene', sceneId: scene.id },
      position,
    })));
    await projectData.openCurrentProject({ projectName, homeDir });
    const analysis = await projectData.writeScreenplayAnalysis({
      homeDir,
      analysis: analysisForScenes(initial.screenplay.scenes.map((scene) => scene.id)),
    });

    const unchanged = await projectData.importFdxScreenplay({ projectName, homeDir, sourcePath });
    expect(unchanged).toMatchObject({
      status: 'unchanged',
      screenplayImport: {
        sourceAssetId: imported.screenplayImport.sourceAssetId,
        sourceAssetFileId: imported.screenplayImport.sourceAssetFileId,
      },
      resourceKeys: [],
    });
    await expect(projectData.readScreenplayStructure({ projectName, homeDir })).resolves.toEqual(initial);
    await expect(projectData.listScreenplayRevisions({ projectName, homeDir })).resolves.toEqual(initialRevisions);
    await expect(projectData.listAssets({
      projectName,
      homeDir,
      owner: { kind: 'project' },
    })).resolves.toEqual(initialAssets);

    await fs.writeFile(sourcePath, markerFdx('ACT TWO', 'RENAMED OUTLINE'), 'utf8');
    const refreshed = await projectData.importFdxScreenplay({ projectName, homeDir, sourcePath });
    expect(refreshed).toMatchObject({ status: 'refreshed', resourceKeys: [] });
    expect(refreshed.screenplayImport.sourceAssetId).not.toBe(imported.screenplayImport.sourceAssetId);
    await expect(projectData.readScreenplayStructure({ projectName, homeDir })).resolves.toEqual(initial);
    await expect(projectData.listScreenplayRevisions({ projectName, homeDir })).resolves.toEqual(initialRevisions);
    await expect(projectData.readScreenplayAnalysis({
      homeDir,
      analysisId: analysis.activeAnalysisId,
    })).resolves.toMatchObject({ freshness: 'current', needsRefresh: false });

    const context = await projectData.readScreenplayAnalysisContext({ homeDir });
    expect(context.analysisMethod).toEqual({
      supported: true,
      model: 'threeAct',
      sourceActMode: 'flat',
    });
    expect(context.screenplay.scenes.map((scene) => scene.heading)).toEqual([
      'INT. FIRST ROOM - DAY',
      'INT. SECOND ROOM - DAY',
      'INT. THIRD ROOM - DAY',
    ]);
    expect(JSON.stringify(context)).not.toContain('ACT TWO');
    expect(JSON.stringify(context)).not.toContain('RENAMED OUTLINE');
    expect(JSON.stringify(context)).not.toContain('<FinalDraft');
  });

  it.each(['missing', 'tampered'] as const)(
    'rejects an exact-byte no-op when the current retained source is %s',
    async (retainedSourceState) => {
      const projectName = await createProject(`fdx-current-source-${retainedSourceState}`);
      await fs.writeFile(sourcePath, screenplayFdx([
        ['1', 'INT. ROOM - DAY', 'MARA', 'Original line.'],
      ]), 'utf8');
      const imported = await projectData.importFdxScreenplay({ projectName, homeDir, sourcePath });
      const assets = await projectData.listAssets({
        projectName,
        homeDir,
        owner: { kind: 'project' },
      });
      const retainedSourceFile = assets
        .find((asset) => asset.id === imported.screenplayImport.sourceAssetId)
        ?.files.find((file) => file.id === imported.screenplayImport.sourceAssetFileId);
      if (!retainedSourceFile) {
        throw new Error('Expected the current retained FDX source file.');
      }
      const retainedSourcePath = path.join(
        homeDir,
        'projects',
        projectName,
        retainedSourceFile.projectRelativePath,
      );
      if (retainedSourceState === 'missing') {
        await fs.unlink(retainedSourcePath);
      } else {
        await fs.writeFile(retainedSourcePath, 'tampered retained source', 'utf8');
      }

      await expect(projectData.importFdxScreenplay({ projectName, homeDir, sourcePath }))
        .rejects.toMatchObject({ code: 'SCREENPLAY_FDX_SOURCE_DESTINATION_CONFLICT' });
    },
  );

  it('automatically applies add, remove, reorder, and one-character changes with whole-Scene identity', async () => {
    const projectName = await createProject('fdx-replacement');
    await fs.writeFile(sourcePath, screenplayFdx([
      ['1', 'INT. FIRST ROOM - DAY', 'MARA', 'First line.'],
      ['2', 'INT. SECOND ROOM - DAY', 'ELIAS', 'Second line.'],
      ['3', 'INT. THIRD ROOM - DAY', 'NOOR', 'Third line.'],
    ]), 'utf8');
    await projectData.importFdxScreenplay({ projectName, homeDir, sourcePath });
    const before = (await projectData.readScreenplayStructure({ projectName, homeDir })).screenplay;
    const beforeRevisions = await projectData.listScreenplayRevisions({ projectName, homeDir });
    const beforeByHeading = new Map(before.scenes.map((scene) => [scene.heading, scene]));
    await projectData.openCurrentProject({ projectName, homeDir });
    const historicalAnalysis = await projectData.writeScreenplayAnalysis({
      homeDir,
      analysis: analysisForScenes(before.scenes.map((scene) => scene.id)),
    });

    await fs.writeFile(sourcePath, screenplayFdx([
      ['2', 'INT. SECOND ROOM - DAY', 'ELIAS', 'Second line.'],
      ['1', 'INT. FIRST ROOM - DAY', 'MARA', 'First line!'],
      ['4A', 'INT. FOURTH ROOM - DAY', 'IVA', 'Fourth line.'],
    ]), 'utf8');
    const refreshed = await projectData.importFdxScreenplay({ projectName, homeDir, sourcePath });
    const after = (await projectData.readScreenplayStructure({ projectName, homeDir })).screenplay;
    const afterRevisions = await projectData.listScreenplayRevisions({ projectName, homeDir });

    expect(refreshed).toMatchObject({ status: 'refreshed', resourceKeys: expect.any(Array) });
    expect(refreshed.resourceKeys.length).toBeGreaterThan(0);
    expect(after.scenes.map((scene) => scene.heading)).toEqual([
      'INT. SECOND ROOM - DAY',
      'INT. FIRST ROOM - DAY',
      'INT. FOURTH ROOM - DAY',
    ]);
    expect(after.scenes.map((scene) => scene.productionNumber)).toEqual(['2', '1', '4A']);
    expect(collectSceneGraphIds(after.scenes[0]!)).toEqual(
      collectSceneGraphIds(beforeByHeading.get('INT. SECOND ROOM - DAY')!),
    );
    expect(collectSceneGraphIds(after.scenes[1]!)).not.toContain(
      beforeByHeading.get('INT. FIRST ROOM - DAY')!.id,
    );
    expect(collectSceneGraphIds(after.scenes[1]!)).not.toEqual(
      collectSceneGraphIds(beforeByHeading.get('INT. FIRST ROOM - DAY')!),
    );
    expect(after.scenes.some((scene) => scene.heading === 'INT. THIRD ROOM - DAY')).toBe(false);
    expect(afterRevisions.revisions).toHaveLength(beforeRevisions.revisions.length + 1);
    expect(after.sections).toEqual([]);
    expect(after.structure.every((entry) => entry.parentSectionId === undefined)).toBe(true);
    await expect(projectData.readScreenplayAnalysis({
      homeDir,
      analysisId: historicalAnalysis.activeAnalysisId,
    })).resolves.toMatchObject({
      freshness: 'needsRefresh',
      needsRefresh: true,
      analysis: {
        sceneAnalyses: expect.arrayContaining([
          expect.objectContaining({ sceneId: before.scenes[2]!.id }),
        ]),
      },
    });
  });

  it('rejects unsupported changed content atomically and keeps the prior source pointer', async () => {
    const projectName = await createProject('fdx-invalid');
    await fs.writeFile(sourcePath, screenplayFdx([
      ['1', 'INT. ROOM - DAY', 'MARA', 'Original line.'],
    ]), 'utf8');
    const imported = await projectData.importFdxScreenplay({ projectName, homeDir, sourcePath });
    const before = await projectData.readScreenplayStructure({ projectName, homeDir });
    const beforeRevisions = await projectData.listScreenplayRevisions({ projectName, homeDir });
    const beforeAssets = await projectData.listAssets({
      projectName,
      homeDir,
      owner: { kind: 'project' },
    });

    await fs.writeFile(
      sourcePath,
      '<FinalDraft DocumentType="Script"><Content>'
      + '<Paragraph Type="Scene Heading"><Text>INT. ROOM - DAY</Text></Paragraph>'
      + '<Paragraph Type="Custom Visible"><Text>Unknown content.</Text></Paragraph>'
      + '</Content></FinalDraft>',
      'utf8',
    );
    await expect(projectData.importFdxScreenplay({ projectName, homeDir, sourcePath })).rejects.toMatchObject({
      code: 'SCREENPLAY_FDX_UNSUPPORTED_VISIBLE_CONTENT',
    });
    await expect(projectData.readScreenplayStructure({ projectName, homeDir })).resolves.toEqual(before);
    await expect(projectData.listScreenplayRevisions({ projectName, homeDir })).resolves.toEqual(beforeRevisions);
    await expect(projectData.listAssets({
      projectName,
      homeDir,
      owner: { kind: 'project' },
    })).resolves.toEqual(beforeAssets);

    await fs.writeFile(sourcePath, screenplayFdx([
      ['1', 'INT. ROOM - DAY', 'MARA', 'Original line.'],
    ]), 'utf8');
    await expect(projectData.importFdxScreenplay({ projectName, homeDir, sourcePath })).resolves.toMatchObject({
      status: 'unchanged',
      screenplayImport: { sourceAssetId: imported.screenplayImport.sourceAssetId },
    });
  });

  it('reuses immutable retained source history when a later refresh returns to exact prior bytes', async () => {
    const projectName = await createProject('fdx-source-revert');
    const sourceA = screenplayFdx([
      ['1', 'INT. ROOM - DAY', 'MARA', 'Version A.'],
    ]);
    const sourceB = screenplayFdx([
      ['1', 'INT. ROOM - DAY', 'MARA', 'Version B.'],
    ]);
    await fs.writeFile(sourcePath, sourceA, 'utf8');
    const imported = await projectData.importFdxScreenplay({ projectName, homeDir, sourcePath });

    await fs.writeFile(sourcePath, sourceB, 'utf8');
    const changed = await projectData.importFdxScreenplay({ projectName, homeDir, sourcePath });
    expect(changed.screenplayImport.sourceAssetId).not.toBe(
      imported.screenplayImport.sourceAssetId,
    );

    await fs.writeFile(sourcePath, sourceA, 'utf8');
    const reverted = await projectData.importFdxScreenplay({ projectName, homeDir, sourcePath });
    expect(reverted).toMatchObject({
      status: 'refreshed',
      screenplayImport: {
        sourceAssetId: imported.screenplayImport.sourceAssetId,
        sourceAssetFileId: imported.screenplayImport.sourceAssetFileId,
      },
    });
    const screenplay = (await projectData.readScreenplayStructure({
      projectName,
      homeDir,
    })).screenplay;
    const dialogue = screenplay.scenes[0]?.blocks.find((block) => block.type === 'dialogue');
    expect(dialogue?.type === 'dialogue'
      ? dialogue.parts.filter((part) => part.type === 'speech').map((part) => part.text)
      : []).toEqual(['Version A.']);
  });

  it('keeps the current source and aggregate when exact historical source bytes are missing', async () => {
    const projectName = await createProject('fdx-missing-source-history');
    const sourceA = screenplayFdx([
      ['1', 'INT. ROOM - DAY', 'MARA', 'Version A.'],
    ]);
    const sourceB = screenplayFdx([
      ['1', 'INT. ROOM - DAY', 'MARA', 'Version B.'],
    ]);
    await fs.writeFile(sourcePath, sourceA, 'utf8');
    const imported = await projectData.importFdxScreenplay({ projectName, homeDir, sourcePath });
    const assets = await projectData.listAssets({
      projectName,
      homeDir,
      owner: { kind: 'project' },
    });
    const sourceFile = assets
      .find((asset) => asset.id === imported.screenplayImport.sourceAssetId)
      ?.files.find((file) => file.id === imported.screenplayImport.sourceAssetFileId);
    if (!sourceFile) {
      throw new Error('Expected the first retained FDX source file.');
    }

    await fs.writeFile(sourcePath, sourceB, 'utf8');
    const acceptedB = await projectData.importFdxScreenplay({ projectName, homeDir, sourcePath });
    const beforeFailedRevert = await projectData.readScreenplayStructure({ projectName, homeDir });
    await fs.unlink(path.join(homeDir, 'projects', projectName, sourceFile.projectRelativePath));

    await fs.writeFile(sourcePath, sourceA, 'utf8');
    await expect(projectData.importFdxScreenplay({ projectName, homeDir, sourcePath }))
      .rejects.toMatchObject({ code: 'SCREENPLAY_FDX_SOURCE_DESTINATION_CONFLICT' });
    await expect(projectData.readScreenplayStructure({ projectName, homeDir }))
      .resolves.toEqual(beforeFailedRevert);
    await fs.writeFile(sourcePath, sourceB, 'utf8');
    await expect(projectData.importFdxScreenplay({ projectName, homeDir, sourcePath }))
      .resolves.toMatchObject({
        status: 'unchanged',
        screenplayImport: { sourceAssetId: acceptedB.screenplayImport.sourceAssetId },
      });
  });

  it('rolls back retained source rows and files when the source changes after reading', async () => {
    const projectName = await createProject('fdx-source-race');
    await fs.writeFile(sourcePath, screenplayFdx([
      ['1', 'INT. ROOM - DAY', 'MARA', 'Read version.'],
    ]), 'utf8');
    const source = await readFdxSource(sourcePath);
    await fs.writeFile(sourcePath, screenplayFdx([
      ['1', 'INT. ROOM - DAY', 'MARA', 'Changed before copy.'],
    ]), 'utf8');
    const { projectFolder, session } = await openProjectSession({
      projectName,
      homeDir,
    });
    const writeSet = createProjectAssetFileWriteSet({ projectFolder });

    try {
      expect(() => session.db.transaction((tx) => persistFdxSourceAsset({
        session: { ...session, db: tx },
        projectFolder,
        source,
        assetId: 'asset_source_race',
        assetFileId: 'asset_file_source_race',
        now: '2026-08-15T00:00:00.000Z',
        writeSet,
      }))).toThrowError(expect.objectContaining({ code: 'SCREENPLAY_FDX_SOURCE_CHANGED' }));
    } finally {
      rollbackProjectAssetFileWriteSetSync(writeSet);
      session.close();
    }

    await expect(projectData.listAssets({
      projectName,
      homeDir,
      owner: { kind: 'project' },
    })).resolves.toEqual([]);
  });

  it('keeps dialogue, organization, references, and revision restore behind the shared FDX read-only gate', async () => {
    const projectName = await createProject('fdx-read-only');
    await fs.writeFile(sourcePath, screenplayFdx([
      ['1', 'INT. ROOM - DAY', 'MARA', 'Original line.'],
    ]), 'utf8');
    await projectData.importFdxScreenplay({ projectName, homeDir, sourcePath });
    const screenplay = (await projectData.readScreenplayStructure({ projectName, homeDir })).screenplay;
    const scene = screenplay.scenes[0]!;
    const revisions = await projectData.listScreenplayRevisions({ projectName, homeDir });

    const operations: ScreenplayOperation[] = [
      {
        operation: 'opening.replace',
        opening: [{ key: 'opening-action', type: 'action', text: 'New opening.' }],
      },
      {
        operation: 'scene.update',
        scene: {
          id: scene.id,
          heading: 'INT. CHANGED ROOM - NIGHT',
          blocks: scene.blocks,
        },
      },
      {
        operation: 'section.add',
        section: { key: 'act', type: 'act', title: 'ACT ONE' },
        structureEntryKey: 'act-entry',
        placement: { at: 'start' },
      },
      {
        operation: 'reference.add',
        reference: {
          key: 'scene-reference',
          subject: { type: 'castMember', id: 'cast_member_missing' },
          target: { type: 'sceneHeading', scene: { id: scene.id } },
          role: 'mention',
        },
      },
    ];
    for (const operation of operations) {
      await expect(projectData.applyScreenplayOperations({
        projectName,
        homeDir,
        operations: [operation],
      }), `${operation.operation} must reach the shared FDX ownership gate`)
        .rejects.toMatchObject({ code: 'SCREENPLAY_FDX_BACKED_READ_ONLY' });
    }
    await expect(projectData.restoreScreenplayRevision({
      projectName,
      homeDir,
      revisionId: revisions.revisions[0]!.id,
    })).rejects.toMatchObject({ code: 'SCREENPLAY_FDX_BACKED_READ_ONLY' });
  });

  async function createProject(projectName: string): Promise<string> {
    const created = await createBlankMovieProject({
      homeDir,
      projectData,
      projectName,
      title: projectName,
    });
    if (!created) {
      throw new Error(`Expected Project ${projectName} to be created.`);
    }
    return created.projectName;
  }
});

function markerFdx(act: string, outline: string): string {
  return '<FinalDraft DocumentType="Script"><Content>'
    + `<Paragraph Type="New Act"><Text>${act}</Text></Paragraph>`
    + `<Paragraph Type="Summary"><Text>${outline} SUMMARY</Text></Paragraph>`
    + `<Paragraph Type="Outline 1"><Text>${outline}</Text></Paragraph>`
    + '<Paragraph Type="Sequence"><Text>SEQUENCE A</Text></Paragraph>'
    + '<Paragraph Type="Scene Heading" Number="9B"><Text>INT. FIRST ROOM - DAY</Text></Paragraph>'
    + '<Paragraph Type="Action"><Text>First action.</Text></Paragraph>'
    + '<Paragraph Type="End of Act"><Text>END OF ACT</Text></Paragraph>'
    + '<Paragraph Type="Outline 2"><Text>CENTRAL CONFLICT</Text></Paragraph>'
    + '<Paragraph Type="Outline 3"><Text>POSSIBLE SCENE</Text></Paragraph>'
    + '<Paragraph Type="Note"><Text>PLANNING NOTE</Text></Paragraph>'
    + '<Paragraph Type="Scene Heading" Number="1"><Text>INT. SECOND ROOM - DAY</Text></Paragraph>'
    + '<Paragraph Type="Action"><Text>Second action.</Text></Paragraph>'
    + '<Paragraph Type="Scene Heading" Number="3"><Text>INT. THIRD ROOM - DAY</Text></Paragraph>'
    + '<Paragraph Type="Action"><Text>Third action.</Text></Paragraph>'
    + '</Content></FinalDraft>';
}

function screenplayFdx(rows: Array<[string, string, string, string]>): string {
  return '<FinalDraft DocumentType="Script"><Content>'
    + rows.map(([number, heading, character, speech]) =>
      `<Paragraph Type="Scene Heading" Number="${number}"><Text>${heading}</Text></Paragraph>`
      + `<Paragraph Type="Character"><Text>${character}</Text></Paragraph>`
      + `<Paragraph Type="Parenthetical"><Text>(quietly)</Text></Paragraph>`
      + `<Paragraph Type="Dialogue"><Text>${speech}</Text></Paragraph>`
    ).join('')
    + '</Content></FinalDraft>';
}

function collectSceneGraphIds(scene: Scene): string[] {
  const ids = [scene.id];
  for (const block of scene.blocks) {
    ids.push(block.id);
    if (block.type === 'dialogue') {
      ids.push(...block.parts.map((part) => part.id));
    }
    if (block.type === 'dualDialogue') {
      ids.push(block.left.id, ...block.left.parts.map((part) => part.id));
      ids.push(block.right.id, ...block.right.parts.map((part) => part.id));
    }
  }
  return ids;
}

const ANALYSIS_CRITERIA = [
  { key: 'dramaticEnergy', label: 'Dramatic Energy', description: 'Forward pull.' },
  { key: 'stakes', label: 'Stakes', description: 'What can be lost.' },
  { key: 'characterAgency', label: 'Character Agency', description: 'Choice drives story.' },
];

function analysisForScenes(sceneIds: string[]): ScreenplayAnalysis {
  const beatRoles = [
    'hook',
    'incitingIncident',
    'firstPlotPoint',
    'firstPinchPoint',
    'midpoint',
    'secondPinchPoint',
    'secondPlotPoint',
    'climax',
    'resolution',
  ] as const;
  return {
    structureModel: 'threeAct',
    title: 'Historical FDX analysis',
    summary: 'A stored analysis remains readable after source replacement.',
    criteria: ANALYSIS_CRITERIA,
    actSegments: [
      analysisAct('actOne', sceneIds[0]!),
      analysisAct('actTwo', sceneIds[1]!),
      analysisAct('actThree', sceneIds[2]!),
    ],
    keyBeats: beatRoles.map((key, index) => {
      const sceneId = sceneIds[Math.min(Math.floor(index / 3), 2)]!;
      return {
        key,
        label: key,
        sceneId,
        synopsis: `${key} evidence.`,
        scoreByCriterion: analysisScores(),
        critique: analysisCritique(sceneId),
      };
    }),
    sceneAnalyses: sceneIds.map((sceneId) => ({
      sceneId,
      synopsis: `Historical analysis for ${sceneId}.`,
      scoreByCriterion: analysisScores(),
      critique: analysisCritique(sceneId),
    })),
    suggestedScenes: [],
  };
}

function analysisAct(role: ScreenplayAnalysisActRole, sceneId: string) {
  return {
    role,
    title: role,
    synopsis: `${role} segment.`,
    sceneIds: [sceneId],
    scoreByCriterion: analysisScores(),
    critique: analysisCritique(sceneId),
  };
}

function analysisScores(): Record<string, number> {
  return { dramaticEnergy: 70, stakes: 70, characterAgency: 70 };
}

function analysisCritique(sceneId: string): ScreenplayAnalysisCritique {
  return {
    summary: 'Historical critique.',
    evidence: [{ sceneId, text: 'Stored evidence.' }],
    suggestions: ['Keep the dramatic turn clear.'],
  };
}
