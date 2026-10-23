import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import Database from 'better-sqlite3';
import { beforeEach, describe, expect, it } from 'vitest';
import type { CharacterArc, CharacterArcsWriteDocument } from '../../client/character-arcs/model.js';
import type { ProjectRelativePath } from '../../client/project/index.js';
import { createProjectDataService } from '../index.js';
import { openCurrentProject } from '../project-selection/index.js';
import { createTestAssetFileFixture } from '../testing/asset-fixture-helpers.js';
import { createSampleMovieProject, writeConfig } from '../testing/project-data-fixtures.js';

describe('character arcs', () => {
  let homeDir: string;
  let projectData = createProjectDataService();
  let sceneIds: string[];
  let castIds: { narrator: string; mehmed: string };

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-character-arc-test-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
    projectData = createProjectDataService();
    await createSampleMovieProject({ homeDir, projectData });
    await openCurrentProject({ projectName: 'constantinople', homeDir });
    const storyArc = await projectData.readStoryArcResource({ projectName: 'constantinople', homeDir });
    sceneIds = storyArc.scenes.map((scene) => scene.id);
    const cast = await projectData.listCastMembers({ homeDir });
    castIds = {
      narrator: cast.find((member) => member.handle === 'narrator')!.id,
      mehmed: cast.find((member) => member.handle === 'mehmed-ii')!.id,
    };
  });

  it('writes, lists and reads arcs, and shows a shared arc with its owner', async () => {
    const report = await projectData.writeCharacterArcs({
      homeDir,
      document: writeDocument([
        { castMemberId: castIds.mehmed, arc: changeArc() },
        { castMemberId: castIds.narrator, arc: { kind: 'characterArcReference', castMemberId: castIds.mehmed } },
      ]),
    });
    expect(report.written).toEqual([castIds.mehmed, castIds.narrator]);
    expect(report.resourceKeys).toEqual(expect.arrayContaining([`surface:castMember:${castIds.mehmed}`]));

    const list = await projectData.listCharacterArcs({ homeDir });
    expect(list.arcs.map((entry) => [entry.castMemberId, entry.kind, entry.freshness])).toEqual([
      [castIds.narrator, 'characterArcReference', 'current'],
      [castIds.mehmed, 'characterArc', 'current'],
    ]);

    const shared = await projectData.readCastMemberCharacterArcResource({
      homeDir,
      projectName: 'constantinople',
      castMemberId: castIds.narrator,
    });
    expect(shared.sharedWith).toEqual({ ownerCastMemberId: castIds.mehmed, ownerName: 'Mehmed II' });
    expect(shared.arc.arcType).toBe('positiveChange');
    expect(shared.scenes.map((scene) => scene.id)).toEqual(sceneIds);

    const castResource = await projectData.readCastMemberResource({
      homeDir,
      projectName: 'constantinople',
      castMemberId: castIds.narrator,
    });
    expect(castResource.characterArc).toEqual({ kind: 'shared', ownerCastMemberId: castIds.mehmed, ownerName: 'Mehmed II' });
  });

  it('replaces the complete set: a Cast Member left out of a new write loses its arc', async () => {
    await projectData.writeCharacterArcs({
      homeDir,
      document: writeDocument([
        { castMemberId: castIds.mehmed, arc: changeArc() },
        { castMemberId: castIds.narrator, arc: flatArc() },
      ]),
    });
    const report = await projectData.writeCharacterArcs({
      homeDir,
      document: writeDocument([{ castMemberId: castIds.mehmed, arc: changeArc() }]),
    });
    expect(report.cleared).toEqual([castIds.narrator]);
    await expect(projectData.readCharacterArc({ homeDir, castMemberId: castIds.narrator }))
      .rejects.toMatchObject({ code: 'CHARACTER_ARC_NOT_FOUND' });
    const castResource = await projectData.readCastMemberResource({
      homeDir,
      projectName: 'constantinople',
      castMemberId: castIds.narrator,
    });
    expect(castResource.characterArc).toEqual({ kind: 'notWritten', screenplayAnalyzed: false });
  });

  it.each(['validateCharacterArcs', 'writeCharacterArcs'] as const)('%s reports malformed documents before reading project references', async (command) => {
    await projectData.writeCharacterArcs({
      homeDir,
      document: writeDocument([{ castMemberId: castIds.mehmed, arc: changeArc() }]),
    });
    const stored = await projectData.readCharacterArc({ homeDir, castMemberId: castIds.mehmed });
    const malformedLook = changeArc();
    const documents: Array<{ document: unknown; issuePath: string[] }> = [
      { document: null, issuePath: [] },
      { document: [], issuePath: [] },
      { document: { kind: 'characterArcs', arcs: null }, issuePath: ['arcs'] },
      { document: { kind: 'characterArcs', arcs: [null] }, issuePath: ['arcs', '0'] },
      {
        document: writeDocument([{
          castMemberId: castIds.mehmed,
          arc: {
            ...malformedLook,
            turningPoints: [{ ...malformedLook.turningPoints[0]!, lookAssetFileId: {} }, malformedLook.turningPoints[1]!],
          } as CharacterArc,
        }]),
        issuePath: ['arcs', '0', 'arc', 'turningPoints', '0', 'lookAssetFileId'],
      },
    ];
    for (const { document, issuePath } of documents) {
      await expect(projectData[command]({
        homeDir,
        document: document as CharacterArcsWriteDocument,
        filePath: 'character-arcs.json',
      })).rejects.toMatchObject({
        code: 'CHARACTER_ARC_INVALID',
        issues: expect.arrayContaining([expect.objectContaining({
          code: 'CHARACTER_ARC_INVALID',
          location: { filePath: 'character-arcs.json', path: issuePath },
        })]),
      });
    }
    expect(await projectData.readCharacterArc({ homeDir, castMemberId: castIds.mehmed })).toEqual(stored);
  });

  it('collects every structural issue before writing', async () => {
    const flatWithBelief = { ...flatArc(), spine: { ...flatArc().spine, falseBelief: { text: 'x', sceneIds: [sceneIds[0]!] } } };
    const changeWithoutNeed = { ...changeArc(), spine: { want: changeArc().spine.want } };
    const unknownScene = changeArc();
    unknownScene.turningPoints[0] = { ...unknownScene.turningPoints[0]!, sceneIds: ['scene_missing'] };

    await expect(projectData.validateCharacterArcs({
      homeDir,
      document: writeDocument([
        { castMemberId: castIds.narrator, arc: flatWithBelief as CharacterArc },
        { castMemberId: 'cast_missing', arc: changeWithoutNeed as CharacterArc },
      ]),
    })).rejects.toMatchObject({
      code: 'CHARACTER_ARC_INVALID',
      issues: expect.arrayContaining([
        expect.objectContaining({ message: expect.stringMatching(/no spine\.falseBelief/) }),
        expect.objectContaining({ message: expect.stringMatching(/needs spine\.need/) }),
        expect.objectContaining({ message: expect.stringMatching(/Unknown Cast Member id/) }),
      ]),
    });

    await expect(projectData.validateCharacterArcs({
      homeDir,
      document: writeDocument([{ castMemberId: castIds.mehmed, arc: unknownScene }]),
    })).rejects.toMatchObject({
      issues: [expect.objectContaining({ message: 'Unknown Scene id: scene_missing.' })],
    });
    expect((await projectData.listCharacterArcs({ homeDir })).arcs).toEqual([]);
  });

  it('rejects unknown fields, self references and references to arcs outside the document', async () => {
    await expect(projectData.validateCharacterArcs({
      homeDir,
      document: writeDocument([{ castMemberId: castIds.mehmed, arc: { ...changeArc(), mood: 'dark' } as CharacterArc }]),
    })).rejects.toMatchObject({
      issues: [expect.objectContaining({ location: expect.objectContaining({ path: ['arcs', '0', 'arc', 'mood'] }) })],
    });
    await expect(projectData.validateCharacterArcs({
      homeDir,
      document: writeDocument([
        { castMemberId: castIds.mehmed, arc: { kind: 'characterArcReference', castMemberId: castIds.mehmed } },
        { castMemberId: castIds.narrator, arc: { kind: 'characterArcReference', castMemberId: castIds.mehmed } },
      ]),
    })).rejects.toMatchObject({
      issues: expect.arrayContaining([
        expect.objectContaining({ message: 'A Cast Member cannot share its own arc.' }),
        expect.objectContaining({ message: expect.stringMatching(/own arc is in the same document/) }),
      ]),
    });
  });

  it('accepts a look owned by a Cast Member sharing the arc and rejects other assets', async () => {
    const projectFolder = path.join(homeDir, 'projects', 'constantinople');
    await fs.writeFile(path.join(projectFolder, 'narrator-sheet.png'), 'png');
    await fs.writeFile(path.join(projectFolder, 'mehmed-reference.txt'), 'text');
    const narratorSheet = await createTestAssetFileFixture({
      homeDir,
      projectName: 'constantinople',
      owner: { kind: 'castMember', id: castIds.narrator },
      projectRelativePath: 'narrator-sheet.png' as ProjectRelativePath,
      type: 'character_sheet',
      mediaKind: 'image',
      title: 'Narrator — Young',
    });
    const reference = await createTestAssetFileFixture({
      homeDir,
      projectName: 'constantinople',
      owner: { kind: 'castMember', id: castIds.mehmed },
      projectRelativePath: 'mehmed-reference.txt' as ProjectRelativePath,
      type: 'reference',
      mediaKind: 'text',
      title: 'Mehmed reference',
    });
    const withLook = (assetFileId: string): CharacterArc => {
      const arc = changeArc();
      arc.turningPoints[0] = { ...arc.turningPoints[0]!, lookAssetFileId: assetFileId };
      return arc;
    };

    await projectData.writeCharacterArcs({
      homeDir,
      document: writeDocument([
        { castMemberId: castIds.mehmed, arc: withLook(narratorSheet.id) },
        { castMemberId: castIds.narrator, arc: { kind: 'characterArcReference', castMemberId: castIds.mehmed } },
      ]),
    });
    const resource = await projectData.readCastMemberCharacterArcResource({
      homeDir,
      projectName: 'constantinople',
      castMemberId: castIds.mehmed,
    });
    expect(resource.looks.map((look) => look.id)).toEqual([narratorSheet.id]);

    await expect(projectData.validateCharacterArcs({
      homeDir,
      document: writeDocument([{ castMemberId: castIds.mehmed, arc: withLook(reference.id) }]),
    })).rejects.toMatchObject({
      issues: [expect.objectContaining({ message: expect.stringMatching(/available character sheet/) })],
    });
    await expect(projectData.validateCharacterArcs({
      homeDir,
      document: writeDocument([{ castMemberId: castIds.mehmed, arc: withLook(narratorSheet.id) }]),
    })).rejects.toMatchObject({
      issues: [expect.objectContaining({ message: expect.stringMatching(/sharing this arc/) })],
    });
  });

  it('blocks deleting a Cast Member whose arc another Cast Member shares', async () => {
    await projectData.writeCharacterArcs({
      homeDir,
      document: writeDocument([
        { castMemberId: castIds.mehmed, arc: changeArc() },
        { castMemberId: castIds.narrator, arc: { kind: 'characterArcReference', castMemberId: castIds.mehmed } },
      ]),
    });
    await expect(projectData.applyCastOperations({
      homeDir,
      document: { kind: 'castOperations', operations: [{ operation: 'castMember.delete', castMemberId: castIds.mehmed }] },
    })).rejects.toMatchObject({
      issues: expect.arrayContaining([expect.objectContaining({ code: 'CHARACTER_ARC_REFERENCE_IN_USE' })]),
    });
  });

  it('marks arcs as needing refresh after a newer screenplay revision and fails fast on corrupt storage', async () => {
    await projectData.writeCharacterArcs({
      homeDir,
      document: writeDocument([{ castMemberId: castIds.mehmed, arc: changeArc() }]),
    });
    const sqlite = new Database(path.join(homeDir, 'projects', 'constantinople', '.renku', 'project.sqlite'));
    try {
      const stored = JSON.parse(sqlite.prepare('select character_arc from cast_member where id = ?').pluck().get(castIds.mehmed) as string);
      sqlite.prepare('update cast_member set character_arc = ? where id = ?')
        .run(JSON.stringify({ ...stored, writtenAt: '2000-01-01T00:00:00.000Z' }), castIds.mehmed);
    } finally {
      sqlite.close();
    }
    await expect(projectData.readCharacterArc({ homeDir, castMemberId: castIds.mehmed })).resolves.toMatchObject({
      freshness: 'needsRefresh',
      freshnessHelp: 'Screenplay changed since these arcs were written.',
    });

    const corrupt = new Database(path.join(homeDir, 'projects', 'constantinople', '.renku', 'project.sqlite'));
    try {
      corrupt.prepare('update cast_member set character_arc = ? where id = ?').run('{"arc":{}}', castIds.mehmed);
    } finally {
      corrupt.close();
    }
    await expect(projectData.readCharacterArc({ homeDir, castMemberId: castIds.mehmed }))
      .rejects.toMatchObject({ code: 'CHARACTER_ARC_STORED_INVALID' });
  });

  function writeDocument(arcs: CharacterArcsWriteDocument['arcs']): CharacterArcsWriteDocument {
    return { kind: 'characterArcs', arcs };
  }

  function changeArc(): CharacterArc {
    return {
      kind: 'characterArc',
      arcType: 'positiveChange',
      startState: 'Believes force alone will take the city.',
      endState: 'Sees that patience and engineering win it.',
      ends: { high: 'Patience', low: 'Force' },
      spine: {
        want: { text: 'To take the city.', sceneIds: [sceneIds[0]!] },
        need: { text: 'To trust the engineer.', sceneIds: [sceneIds[0]!] },
        falseBelief: { text: 'Walls fall to will alone.', sceneIds: [sceneIds[0]!] },
      },
      turningPoints: [
        { sceneIds: [sceneIds[0]!], label: 'Rejects the founder', state: 'Impatient.', position: -3 },
        { sceneIds: [sceneIds[sceneIds.length - 1]!], label: 'Hears the cannon', state: 'Convinced.', position: 4 },
      ],
    };
  }

  function flatArc(): CharacterArc {
    return {
      kind: 'characterArc',
      arcType: 'flat',
      startState: 'Tells the story as it was.',
      endState: 'Still tells it as it was.',
      ends: { high: 'Certain', low: 'Doubting' },
      spine: {
        want: { text: 'To be heard.', sceneIds: [sceneIds[0]!] },
        truthHeld: { text: 'Memory outlasts empires.', sceneIds: [sceneIds[0]!] },
      },
      turningPoints: [
        { sceneIds: [sceneIds[0]!], label: 'Opens the tale', state: 'Calm.', position: 4 },
        { sceneIds: [sceneIds[0]!], label: 'Closes the tale', state: 'Calm.', position: 4 },
      ],
    };
  }
});
