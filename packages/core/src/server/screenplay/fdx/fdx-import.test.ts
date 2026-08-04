import { createHash } from 'node:crypto';
import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { beforeEach, describe, expect, it } from 'vitest';
import { createProjectDataService } from '../../index.js';
import {
  createBlankMovieProject,
  writeConfig,
} from '../../testing/project-data-fixtures.js';
import { mapFdxScreenplay } from './mapping/screenplay.js';
import { parseFdxDocument } from './parser/document.js';
import { MAX_FDX_SOURCE_BYTES, readFdxSource } from './source.js';

const SOURCE_SHA = 'a'.repeat(64);

describe('deterministic FDX import', () => {
  let homeDir: string;
  let sourcePath: string;

  beforeEach(async () => {
    homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-fdx-import-test-'));
    await writeConfig(homeDir, path.join(homeDir, 'projects'));
    sourcePath = path.join(homeDir, 'source.fdx');
    await fs.writeFile(sourcePath, representativeFdx(), 'utf8');
  });

  it('maps the supported visible subset, dialogue, sections, and deterministic IDs', () => {
    const first = mapFdxScreenplay(parseFdxDocument(representativeFdx()), SOURCE_SHA);
    const second = mapFdxScreenplay(parseFdxDocument(representativeFdx()), SOURCE_SHA);

    expect(second.screenplay).toEqual(first.screenplay);
    const repeated = mapFdxScreenplay(parseFdxDocument(
      '<FinalDraft DocumentType="Script"><Content>'
      + '<Paragraph Type="Scene Heading"><Text>INT. ROOM - DAY</Text></Paragraph>'
      + '<Paragraph Type="Action"><Text>Same.</Text></Paragraph>'
      + '<Paragraph Type="Action"><Text>Same.</Text></Paragraph>'
      + '</Content></FinalDraft>',
    ), SOURCE_SHA);
    expect(repeated.screenplay.scenes[0]?.blocks[0]?.id).not.toBe(
      repeated.screenplay.scenes[0]?.blocks[1]?.id,
    );
    const realWorldDialogue = mapFdxScreenplay(parseFdxDocument(
      '<FinalDraft DocumentType="Script"><Content>'
      + '<Paragraph Type="Scene Heading"><Text>INT. ROOM - DAY</Text></Paragraph>'
      + '<Paragraph Type="Action"><Text>A card reads:</Text></Paragraph>'
      + '<Paragraph Type="Dialogue"><Text>Meet me at noon.</Text></Paragraph>'
      + '<Paragraph Type="Dialogue"><Text></Text></Paragraph>'
      + '<Paragraph Type="Parenthetical"><Text></Text></Paragraph>'
      + '<Paragraph Type="Character"><Text>CALLER</Text></Paragraph>'
      + '<Paragraph Type="Dialogue"><Text>One visible line.</Text></Paragraph>'
      + '<Paragraph Type="Dialogue"><Text></Text></Paragraph>'
      + '<Paragraph Type="General"><DualDialogue>'
      + '<Paragraph Type="Character"><Text>LEFT</Text></Paragraph>'
      + '<Paragraph Type="Dialogue"><Text>Same time.</Text></Paragraph>'
      + '<Paragraph Type="Character"><Text>RIGHT</Text></Paragraph>'
      + '<Paragraph Type="Dialogue"><Text>Same place.</Text></Paragraph>'
      + '</DualDialogue></Paragraph>'
      + '</Content></FinalDraft>',
    ), SOURCE_SHA);
    expect(realWorldDialogue.screenplay.scenes[0]?.blocks).toMatchObject([
      { type: 'action', text: 'A card reads:' },
      { type: 'action', text: 'Meet me at noon.' },
      {
        type: 'dialogue',
        characterName: 'CALLER',
        parts: [{ type: 'speech', text: 'One visible line.' }],
      },
      {
        type: 'dualDialogue',
        left: { characterName: 'LEFT', parts: [{ text: 'Same time.' }] },
        right: { characterName: 'RIGHT', parts: [{ text: 'Same place.' }] },
      },
    ]);
    expect(realWorldDialogue.technicalLog).toEqual([{
      type: 'orphanDialogueNormalization',
      sourceParagraphIndex: 2,
      sourceParagraphType: 'Dialogue',
      targetBlockType: 'action',
    }]);
    expect(first.screenplay.opening).toMatchObject([
      { type: 'transition', text: 'FADE IN:' },
    ]);
    expect(first.screenplay.sections.map((section) => [section.type, section.title])).toEqual([
      ['act', 'ACT ONE'],
      ['sequence', 'THE ARRIVAL'],
    ]);
    expect(first.screenplay.scenes[0]).toMatchObject({
      productionNumber: '1A',
      heading: 'INT. WORKSHOP - NIGHT',
      blocks: [
        { type: 'action', text: 'A lamp & a bell flicker.' },
        {
          type: 'dialogue',
          characterName: 'MARA',
          extensions: ['V.O.'],
          parts: [
            { type: 'parenthetical', text: 'quietly, then louder' },
            { type: 'speech', text: 'First line.' },
            { type: 'parenthetical', text: 'a beat' },
            { type: 'speech', text: 'Second line.' },
          ],
        },
      ],
    });
    expect(first.screenplay.scenes[1]?.blocks[0]).toMatchObject({
      type: 'dualDialogue',
      left: { characterName: 'MARA' },
      right: { characterName: 'ELIAS', extensions: ['O.S.'] },
    });
    expect(first.counts).toEqual({
      scenes: 2,
      acts: 1,
      sequences: 1,
      blocks: 4,
      dialogueTurns: 3,
      productionSceneNumbers: 1,
    });
    expect(first.candidates.characterCues.map((candidate) => candidate.characterName)).toEqual([
      'MARA',
      'ELIAS',
    ]);
    expect(first.candidates.taggedSubjects.map((candidate) => [
      candidate.label,
      candidate.category,
      candidate.target.type,
    ])).toEqual([
      ['Workshop', 'Location', 'sceneHeading'],
      ['Bell', 'Props', 'block'],
      ['Mara', 'Cast Members', 'dialogueCue'],
      ['Whisper', 'Sound', 'dialoguePart'],
    ]);
    expect(first.technicalLog).toEqual([
      {
        type: 'paragraphNormalization',
        sourceParagraphIndex: 0,
        sourceParagraphType: 'General',
        targetBlockType: 'transition',
      },
    ]);
  });

  it('assigns distinct identities to consecutive direct DualDialogue containers', () => {
    const mapped = mapFdxScreenplay(parseFdxDocument(
      '<FinalDraft DocumentType="Script"><Content>'
      + '<Paragraph Type="Scene Heading"><Text>INT. ROOM - DAY</Text></Paragraph>'
      + '<DualDialogue>'
      + '<Paragraph Type="Character"><Text>LEFT ONE</Text></Paragraph>'
      + '<Paragraph Type="Dialogue"><Text>First left.</Text></Paragraph>'
      + '<Paragraph Type="Character"><Text>RIGHT ONE</Text></Paragraph>'
      + '<Paragraph Type="Dialogue"><Text>First right.</Text></Paragraph>'
      + '</DualDialogue>'
      + '<DualDialogue>'
      + '<Paragraph Type="Character"><Text>LEFT TWO</Text></Paragraph>'
      + '<Paragraph Type="Dialogue"><Text>Second left.</Text></Paragraph>'
      + '<Paragraph Type="Character"><Text>RIGHT TWO</Text></Paragraph>'
      + '<Paragraph Type="Dialogue"><Text>Second right.</Text></Paragraph>'
      + '</DualDialogue>'
      + '</Content></FinalDraft>',
    ), SOURCE_SHA);

    const blocks = mapped.screenplay.scenes[0]?.blocks ?? [];
    expect(blocks).toHaveLength(2);
    expect(new Set(blocks.map((block) => block.id))).toHaveProperty('size', 2);
  });

  it('rejects unsafe, malformed, unsupported, deeply nested, and oversized input', async () => {
    expect(() => parseFdxDocument(
      '<!DOCTYPE FinalDraft><FinalDraft DocumentType="Script"><Content/></FinalDraft>',
    )).toThrowError(expect.objectContaining({ code: 'SCREENPLAY_FDX_UNSAFE_XML' }));
    expect(() => parseFdxDocument(
      '<FinalDraft DocumentType="Script"><Content></FinalDraft>',
    )).toThrowError(expect.objectContaining({ code: 'SCREENPLAY_FDX_INVALID_XML' }));
    expect(() => parseFdxDocument(
      '<FinalDraft DocumentType="Script"><Content><VisibleMystery>Lost line</VisibleMystery></Content></FinalDraft>',
    )).toThrowError(expect.objectContaining({ code: 'SCREENPLAY_FDX_UNSUPPORTED_VISIBLE_CONTENT' }));
    const nested = '<Extension>'.repeat(65) + '</Extension>'.repeat(65);
    expect(() => parseFdxDocument(
      `<FinalDraft DocumentType="Script"><Content/>${nested}</FinalDraft>`,
    )).toThrowError(expect.objectContaining({ code: 'SCREENPLAY_FDX_LIMIT_EXCEEDED' }));
    await fs.writeFile(sourcePath, Buffer.alloc(MAX_FDX_SOURCE_BYTES + 1));
    await expect(readFdxSource(sourcePath)).rejects.toMatchObject({
      code: 'SCREENPLAY_FDX_SOURCE_TOO_LARGE',
    });
  });

  it('commits the Screenplay, exact source Asset, and singleton provenance atomically', async () => {
    const projectData = createProjectDataService();
    const created = await createBlankMovieProject({
      homeDir,
      projectData,
      projectName: 'fdx-movie',
      title: 'FDX Movie',
    });
    if (!created) {
      return;
    }

    const report = await projectData.importFdxScreenplay({
      projectName: created.projectName,
      homeDir,
      sourcePath,
    });
    const resource = await projectData.readScreenplayStructure({
      projectName: created.projectName,
      homeDir,
    });
    const retainedPath = path.join(
      created.projectPath,
      'screenplay',
      'sources',
      `${report.screenplayImport.sha256}.fdx`,
    );

    expect(resource.screenplay.scenes).toHaveLength(2);
    await expect(fs.readFile(retainedPath)).resolves.toEqual(await fs.readFile(sourcePath));
    expect((await projectData.listAssets({
      projectName: created.projectName,
      homeDir,
      owner: { kind: 'project' },
    })).find((asset) => asset.id === report.screenplayImport.sourceAssetId)).toMatchObject({
      owner: { kind: 'project' },
      type: 'screenplay_source',
      mediaKind: 'document',
      files: [{
        id: report.screenplayImport.sourceAssetFileId,
        role: 'source',
        mimeType: 'application/xml',
        contentHash: report.screenplayImport.sha256,
      }],
    });
    await fs.unlink(retainedPath);
    await expect(projectData.readScreenplayStructure({
      projectName: created.projectName,
      homeDir,
    })).resolves.toMatchObject({ orderedSceneIds: expect.any(Array) });
    await expect(projectData.importFdxScreenplay({
      projectName: created.projectName,
      homeDir,
      sourcePath,
    })).rejects.toMatchObject({ code: 'SCREENPLAY_FDX_IMPORT_EXISTS' });
    await expect(projectData.discardAsset({
      projectName: created.projectName,
      homeDir,
      assetId: report.screenplayImport.sourceAssetId,
      owner: { kind: 'project' },
    })).rejects.toMatchObject({ code: 'SCREENPLAY_FDX_SOURCE_IN_USE' });
  });

  it('rolls back database rows when the hash-addressed destination conflicts', async () => {
    const projectData = createProjectDataService();
    const created = await createBlankMovieProject({
      homeDir,
      projectData,
      projectName: 'fdx-conflict',
      title: 'FDX Conflict',
    });
    if (!created) {
      return;
    }
    const bytes = await fs.readFile(sourcePath);
    const sha256 = createHash('sha256').update(bytes).digest('hex');
    const destination = path.join(
      created.projectPath,
      'screenplay',
      'sources',
      `${sha256}.fdx`,
    );
    await fs.mkdir(path.dirname(destination), { recursive: true });
    await fs.writeFile(destination, 'conflict', 'utf8');

    await expect(projectData.importFdxScreenplay({
      projectName: created.projectName,
      homeDir,
      sourcePath,
    })).rejects.toMatchObject({
      code: 'SCREENPLAY_FDX_SOURCE_DESTINATION_CONFLICT',
    });
    const resource = await projectData.readScreenplayStructure({
      projectName: created.projectName,
      homeDir,
    });
    expect(resource.screenplay.scenes).toEqual([]);
    await expect(projectData.listAssets({
      projectName: created.projectName,
      homeDir,
      owner: { kind: 'project' },
    })).resolves.toEqual([]);
    await expect(fs.readFile(destination, 'utf8')).resolves.toBe('conflict');
  });

  it('rejects a non-empty Screenplay before creating a retained source', async () => {
    const projectData = createProjectDataService();
    const created = await createBlankMovieProject({
      homeDir,
      projectData,
      projectName: 'fdx-non-empty',
      title: 'FDX Non-empty',
    });
    if (!created) {
      return;
    }
    await projectData.createScreenplay({
      projectName: created.projectName,
      homeDir,
      screenplay: {
        opening: [],
        scenes: [{ key: 'scene', heading: 'INT. ROOM - DAY', blocks: [] }],
        sections: [],
        structure: [{
          key: 'placement',
          content: { type: 'scene', scene: { key: 'scene' } },
          position: 0,
        }],
        references: [],
      },
    });

    await expect(projectData.importFdxScreenplay({
      projectName: created.projectName,
      homeDir,
      sourcePath,
    })).rejects.toMatchObject({ code: 'SCREENPLAY_NOT_EMPTY' });
    await expect(fs.stat(path.join(created.projectPath, 'screenplay', 'sources'))).rejects.toThrow();
  });
});

function representativeFdx(): string {
  return fsSync.readFileSync(
    fileURLToPath(new URL('./fixtures/representative.fdx', import.meta.url)),
    'utf8',
  );
}
