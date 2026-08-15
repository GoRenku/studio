import fs from 'node:fs/promises';
import fsSync from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { describe, expect, it } from 'vitest';
import { mapFdxScreenplay } from './mapping/screenplay.js';
import { parseFdxDocument } from './parser/document.js';
import { MAX_FDX_SOURCE_BYTES, readFdxSource } from './source.js';

const SOURCE_SHA = 'a'.repeat(64);

describe('FDX parser and mapper', () => {
  it('maps supported screenplay content into a deterministic flat Screenplay', () => {
    const first = mapFdxScreenplay(parseFdxDocument(representativeFdx()), SOURCE_SHA);
    const second = mapFdxScreenplay(parseFdxDocument(representativeFdx()), SOURCE_SHA);

    expect(second.screenplay).toEqual(first.screenplay);
    expect(first.screenplay.opening).toMatchObject([
      { type: 'transition', text: 'FADE IN:' },
    ]);
    expect(first.screenplay.sections).toEqual([]);
    expect(first.screenplay.structure).toHaveLength(2);
    expect(first.screenplay.structure).toEqual(first.screenplay.scenes.map((scene, position) => ({
      id: expect.any(String),
      content: { type: 'scene', sceneId: scene.id },
      position,
    })));
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
  });

  it('omits known Final Draft formatting and planning paragraphs without inferring hierarchy', () => {
    const mapped = mapFdxScreenplay(parseFdxDocument(
      '<FinalDraft DocumentType="Script"><Content>'
      + '<Paragraph Type="New Act"><Text>ACT ONE</Text></Paragraph>'
      + '<Paragraph Type="Summary"><Text>Opening summary.</Text></Paragraph>'
      + '<Paragraph Type="Outline 1"><Text>Custom lane one.</Text></Paragraph>'
      + '<Paragraph Type="Outline 2"><Text>Central conflict.</Text></Paragraph>'
      + '<Paragraph Type="Outline 3"><Text>Possible scene.</Text></Paragraph>'
      + '<Paragraph Type="Note"><Text>Planning note.</Text></Paragraph>'
      + '<Paragraph Type="Sequence"><Text>THE ARRIVAL</Text></Paragraph>'
      + '<Paragraph Type="Scene Heading"><Text>INT. FIRST ROOM - DAY</Text></Paragraph>'
      + '<Paragraph Type="Action"><Text>ACT ONE</Text></Paragraph>'
      + '<Paragraph Type="General"><Text>Sequence 4</Text></Paragraph>'
      + '<Paragraph Type="End of Act"><Text>END OF ACT</Text></Paragraph>'
      + '<Paragraph Type="Scene Heading"><Text>INT. SECOND ROOM - DAY</Text></Paragraph>'
      + '</Content><DisplayBoards><Board Name="Acts"/></DisplayBoards></FinalDraft>',
    ), SOURCE_SHA);

    expect(mapped.screenplay.sections).toEqual([]);
    expect(mapped.screenplay.structure.map((entry) => ({
      parentSectionId: entry.parentSectionId,
      content: entry.content,
      position: entry.position,
    }))).toEqual([
      {
        parentSectionId: undefined,
        content: { type: 'scene', sceneId: mapped.screenplay.scenes[0]!.id },
        position: 0,
      },
      {
        parentSectionId: undefined,
        content: { type: 'scene', sceneId: mapped.screenplay.scenes[1]!.id },
        position: 1,
      },
    ]);
    expect(mapped.screenplay.scenes[0]?.blocks).toMatchObject([
      { type: 'action', text: 'ACT ONE' },
      { type: 'action', text: 'Sequence 4' },
    ]);
    expect(JSON.stringify(mapped.screenplay)).not.toContain('Central conflict.');
    expect(mapped.technicalLog).toEqual([{
      type: 'paragraphNormalization',
      sourceParagraphIndex: 9,
      sourceParagraphType: 'General',
      targetBlockType: 'action',
    }]);
  });

  it('rejects an unknown visible paragraph type with its FDX path', () => {
    expect(() => mapFdxScreenplay(parseFdxDocument(
      '<FinalDraft DocumentType="Script"><Content>'
      + '<Paragraph Type="Scene Heading"><Text>INT. ROOM - DAY</Text></Paragraph>'
      + '<Paragraph Type="Custom Beat"><Text>Visible custom content.</Text></Paragraph>'
      + '</Content></FinalDraft>',
    ), SOURCE_SHA)).toThrowError(expect.objectContaining({
      code: 'SCREENPLAY_FDX_UNSUPPORTED_VISIBLE_CONTENT',
      message: expect.stringMatching(/Custom Beat.*FinalDraft\/Content\/Paragraph\[1\]|FinalDraft\/Content\/Paragraph\[1\].*Custom Beat/u),
    }));
  });

  it('maps orphan and dual dialogue without inventing empty blocks', () => {
    const mapped = mapFdxScreenplay(parseFdxDocument(
      '<FinalDraft DocumentType="Script"><Content>'
      + '<Paragraph Type="Scene Heading"><Text>INT. ROOM - DAY</Text></Paragraph>'
      + '<Paragraph Type="Action"><Text>A card reads:</Text></Paragraph>'
      + '<Paragraph Type="Dialogue"><Text>Meet me at noon.</Text></Paragraph>'
      + '<Paragraph Type="Dialogue"><Text></Text></Paragraph>'
      + '<Paragraph Type="Parenthetical"><Text></Text></Paragraph>'
      + '<Paragraph Type="Character"><Text>CALLER</Text></Paragraph>'
      + '<Paragraph Type="Dialogue"><Text>One visible line.</Text></Paragraph>'
      + '<Paragraph Type="General"><DualDialogue>'
      + '<Paragraph Type="Character"><Text>LEFT</Text></Paragraph>'
      + '<Paragraph Type="Dialogue"><Text>Same time.</Text></Paragraph>'
      + '<Paragraph Type="Character"><Text>RIGHT</Text></Paragraph>'
      + '<Paragraph Type="Dialogue"><Text>Same place.</Text></Paragraph>'
      + '</DualDialogue></Paragraph>'
      + '</Content></FinalDraft>',
    ), SOURCE_SHA);

    expect(mapped.screenplay.scenes[0]?.blocks).toMatchObject([
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
  });

  it('assigns distinct path identities and ignores FDX UUID/Id attributes', () => {
    const xml = '<FinalDraft DocumentType="Script"><Content>'
      + '<Paragraph Type="Scene Heading" UUID="same"><Text>INT. ROOM - DAY</Text></Paragraph>'
      + '<Paragraph Type="Action" Id="same"><Text>Same.</Text></Paragraph>'
      + '<Paragraph Type="Action" Id="same"><Text>Same.</Text></Paragraph>'
      + '</Content></FinalDraft>';
    const first = mapFdxScreenplay(parseFdxDocument(xml), 'a'.repeat(64));
    const changedSource = mapFdxScreenplay(parseFdxDocument(xml), 'b'.repeat(64));

    expect(first.screenplay.scenes[0]?.id).not.toBe(changedSource.screenplay.scenes[0]?.id);
    expect(first.screenplay.scenes[0]?.blocks[0]?.id).not.toBe(
      first.screenplay.scenes[0]?.blocks[1]?.id,
    );
    expect(parseFdxDocument(xml).content[0]).not.toHaveProperty('sourceId');
  });

  it('preserves supplied Scene numbers exactly without sorting or invention', () => {
    const mapped = mapFdxScreenplay(parseFdxDocument(
      '<FinalDraft DocumentType="Script"><Content>'
      + '<Paragraph Type="Scene Heading" Number="9B"><Text>INT. ONE - DAY</Text></Paragraph>'
      + '<Paragraph Type="Scene Heading" Number="1"><Text>INT. TWO - DAY</Text></Paragraph>'
      + '<Paragraph Type="Scene Heading" Number="1"><Text>INT. THREE - DAY</Text></Paragraph>'
      + '<Paragraph Type="Scene Heading" Number=""><Text>INT. FOUR - DAY</Text></Paragraph>'
      + '<Paragraph Type="Scene Heading"><Text>INT. FIVE - DAY</Text></Paragraph>'
      + '</Content></FinalDraft>',
    ), SOURCE_SHA);

    expect(mapped.screenplay.scenes.map((scene) => scene.heading)).toEqual([
      'INT. ONE - DAY',
      'INT. TWO - DAY',
      'INT. THREE - DAY',
      'INT. FOUR - DAY',
      'INT. FIVE - DAY',
    ]);
    expect(mapped.screenplay.scenes.map((scene) => scene.productionNumber)).toEqual([
      '9B',
      '1',
      '1',
      '',
      undefined,
    ]);
    expect(mapped.counts.productionSceneNumbers).toBe(4);
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

    const homeDir = await fs.mkdtemp(path.join(os.tmpdir(), 'renku-fdx-source-test-'));
    const sourcePath = path.join(homeDir, 'source.fdx');
    await fs.writeFile(sourcePath, Buffer.alloc(MAX_FDX_SOURCE_BYTES + 1));
    await expect(readFdxSource(sourcePath)).rejects.toMatchObject({
      code: 'SCREENPLAY_FDX_SOURCE_TOO_LARGE',
    });
  });
});

function representativeFdx(): string {
  return fsSync.readFileSync(
    fileURLToPath(new URL('./fixtures/representative.fdx', import.meta.url)),
    'utf8',
  );
}
