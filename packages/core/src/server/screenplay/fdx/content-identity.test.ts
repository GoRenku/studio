import type { Scene } from '../../../client/screenplay/index.js';
import { describe, expect, it } from 'vitest';
import {
  fdxFlatScreenplayContentHash,
  fdxSceneContentHash,
  retainCurrentFdxScreenplayWhenEqual,
  reuseUniqueUnchangedFdxScenes,
} from './content-identity.js';
import { mapFdxScreenplay } from './mapping/screenplay.js';
import { parseFdxDocument } from './parser/document.js';

describe('FDX content identity', () => {
  it('hashes every canonical Scene value while excluding IDs', () => {
    const scene = completeScene();
    const original = fdxSceneContentHash(scene);
    const withDifferentIds = structuredClone(scene);
    withDifferentIds.id = 'scene_other';
    withDifferentIds.blocks[0]!.id = 'block_other';
    if (withDifferentIds.blocks[1]?.type === 'dialogue') {
      withDifferentIds.blocks[1].parts[0]!.id = 'part_other';
    }
    expect(fdxSceneContentHash(withDifferentIds)).toBe(original);

    const changes: Array<(value: Scene) => void> = [
      (value) => { value.productionNumber = '2'; },
      (value) => { delete value.productionNumber; },
      (value) => { value.heading = 'INT. OTHER ROOM - NIGHT'; },
      (value) => { value.title = 'Other title'; },
      (value) => { delete value.title; },
      (value) => {
        if (value.blocks[0]?.type === 'action') {
          value.blocks[0].text = 'Changed.';
        }
      },
      (value) => {
        if (value.blocks[0]?.type === 'action') {
          value.blocks[0] = { ...value.blocks[0], type: 'shot' };
        }
      },
      (value) => { value.blocks.reverse(); },
      (value) => {
        if (value.blocks[1]?.type === 'dialogue') {
          value.blocks[1].characterName = 'OTHER';
        }
      },
      (value) => {
        if (value.blocks[1]?.type === 'dialogue') {
          value.blocks[1].extensions.push('O.S.');
        }
      },
      (value) => {
        if (value.blocks[1]?.type === 'dialogue') {
          value.blocks[1].parts[0]!.text = 'Changed';
        }
      },
      (value) => {
        if (value.blocks[1]?.type === 'dialogue') {
          value.blocks[1].parts[0] = {
            ...value.blocks[1].parts[0]!,
            type: 'speech',
          };
        }
      },
      (value) => {
        if (value.blocks[1]?.type === 'dialogue') {
          value.blocks[1].parts[1]!.text = 'Changed speech.';
        }
      },
      (value) => {
        if (value.blocks[1]?.type === 'dialogue') {
          value.blocks[1].parts.reverse();
        }
      },
      (value) => {
        if (value.blocks[2]?.type === 'dualDialogue') {
          value.blocks[2].left.characterName = 'OTHER';
        }
      },
      (value) => {
        if (value.blocks[2]?.type === 'dualDialogue') {
          value.blocks[2].left.extensions.push('V.O.');
        }
      },
      (value) => {
        if (value.blocks[2]?.type === 'dualDialogue') {
          value.blocks[2].right.parts[0]!.text = 'Changed';
        }
      },
    ];

    for (const change of changes) {
      const changed = structuredClone(scene);
      change(changed);
      expect(fdxSceneContentHash(changed)).not.toBe(original);
    }
  });

  it('reuses one exact unique Scene as a whole graph and replaces a changed Scene completely', () => {
    const current = mapped([
      ['INT. SAME ROOM - DAY', 'SAME', 'Same line.'],
      ['INT. CHANGED ROOM - DAY', 'BEFORE', 'Old line.'],
    ], 'a').screenplay;
    const proposal = mapped([
      ['INT. SAME ROOM - DAY', 'SAME', 'Same line.'],
      ['INT. CHANGED ROOM - DAY', 'AFTER', 'New line.'],
    ], 'b');

    const result = reuseUniqueUnchangedFdxScenes({
      current,
      proposed: proposal.screenplay,
      candidates: proposal.candidates,
    });

    expect(collectSceneGraphIds(result.screenplay.scenes[0]!)).toEqual(
      collectSceneGraphIds(current.scenes[0]!),
    );
    expect(collectSceneGraphIds(result.screenplay.scenes[1]!)).not.toContain(
      current.scenes[1]!.id,
    );
    expect(collectSceneGraphIds(result.screenplay.scenes[1]!)).toEqual(
      collectSceneGraphIds(proposal.screenplay.scenes[1]!),
    );
    expect(result.candidates.sceneHeadings[0]?.sceneId).toBe(current.scenes[0]!.id);
    expect(result.screenplay.structure.map((entry) =>
      entry.content.type === 'scene' ? entry.content.sceneId : null
    )).toEqual(result.screenplay.scenes.map((scene) => scene.id));
  });

  it('does not pair duplicate exact Scenes', () => {
    const current = mapped([
      ['INT. REPEATED ROOM - DAY', 'SAME', 'Same line.'],
      ['INT. REPEATED ROOM - DAY', 'SAME', 'Same line.'],
    ], 'a').screenplay;
    const proposal = mapped([
      ['INT. REPEATED ROOM - DAY', 'SAME', 'Same line.'],
      ['INT. REPEATED ROOM - DAY', 'SAME', 'Same line.'],
    ], 'b');

    const result = reuseUniqueUnchangedFdxScenes({
      current,
      proposed: proposal.screenplay,
      candidates: proposal.candidates,
    });

    expect(result.screenplay.scenes.map((scene) => scene.id)).toEqual(
      proposal.screenplay.scenes.map((scene) => scene.id),
    );
    expect(result.screenplay.scenes.map((scene) => scene.id)).not.toEqual(
      current.scenes.map((scene) => scene.id),
    );
  });

  it('retains the complete current aggregate and redirects candidates when canonical content is equal', () => {
    const currentMapped = mapped([
      ['INT. FIRST ROOM - DAY', 'FIRST', 'First line.'],
      ['INT. SECOND ROOM - DAY', 'SECOND', 'Second line.'],
    ], 'a');
    const proposedMapped = mapped([
      ['INT. FIRST ROOM - DAY', 'FIRST', 'First line.'],
      ['INT. SECOND ROOM - DAY', 'SECOND', 'Second line.'],
    ], 'b');

    expect(fdxFlatScreenplayContentHash(currentMapped.screenplay)).toBe(
      fdxFlatScreenplayContentHash(proposedMapped.screenplay),
    );
    const result = retainCurrentFdxScreenplayWhenEqual({
      current: currentMapped.screenplay,
      proposed: proposedMapped.screenplay,
      candidates: proposedMapped.candidates,
    });

    expect(result?.screenplay).toEqual(currentMapped.screenplay);
    expect(result?.candidates.sceneHeadings.map((candidate) => candidate.sceneId)).toEqual(
      currentMapped.screenplay.scenes.map((scene) => scene.id),
    );
    expect(result?.candidates.characterCues.flatMap((candidate) => candidate.turnIds)).toEqual(
      currentMapped.screenplay.scenes.map((scene) => {
        const dialogue = scene.blocks.find((block) => block.type === 'dialogue');
        return dialogue?.id;
      }),
    );
  });
});

function mapped(rows: Array<[string, string, string]>, shaCharacter: string) {
  return mapFdxScreenplay(parseFdxDocument(
    '<FinalDraft DocumentType="Script"><Content>'
    + rows.map(([heading, character, speech]) =>
      `<Paragraph Type="Scene Heading"><Text>${heading}</Text></Paragraph>`
      + `<Paragraph Type="Character"><Text>${character}</Text></Paragraph>`
      + `<Paragraph Type="Dialogue"><Text>${speech}</Text></Paragraph>`
    ).join('')
    + '</Content></FinalDraft>',
  ), shaCharacter.repeat(64));
}

function completeScene(): Scene {
  return {
    id: 'scene_1',
    productionNumber: '1A',
    heading: 'INT. ROOM - DAY',
    title: 'Arrival',
    blocks: [
      { id: 'block_1', type: 'action', text: 'Action.' },
      {
        id: 'dialogue_1',
        type: 'dialogue',
        characterName: 'MARA',
        extensions: ['V.O.'],
        parts: [
          { id: 'part_1', type: 'parenthetical', text: 'quietly' },
          { id: 'part_2', type: 'speech', text: 'Hello.' },
        ],
      },
      {
        id: 'dual_1',
        type: 'dualDialogue',
        left: {
          id: 'turn_left',
          characterName: 'LEFT',
          extensions: [],
          parts: [{ id: 'part_left', type: 'speech', text: 'Left.' }],
        },
        right: {
          id: 'turn_right',
          characterName: 'RIGHT',
          extensions: ['O.S.'],
          parts: [{ id: 'part_right', type: 'speech', text: 'Right.' }],
        },
      },
    ],
  };
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
