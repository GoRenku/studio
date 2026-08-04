import type {
  DialogueTurn,
  Scene,
  ScreenplayReferenceTarget,
} from '../../../../client/screenplay/index.js';
import type { ScreenplayImportCandidates } from '../contracts.js';
import type { FdxParagraph } from '../parser/types.js';

export class FdxCandidateCollector {
  private readonly cueTurns = new Map<string, string[]>();
  private readonly taggedSubjects: ScreenplayImportCandidates['taggedSubjects'] = [];

  constructor(
    private readonly tagsByNumber: Record<string, { label: string; category: string }>,
  ) {}

  addDialogueTurn(turn: DialogueTurn): void {
    const ids = this.cueTurns.get(turn.characterName) ?? [];
    ids.push(turn.id);
    this.cueTurns.set(turn.characterName, ids);
  }

  addTaggedTarget(tagNumbers: string[], target: ScreenplayReferenceTarget): void {
    for (const number of tagNumbers) {
      const tag = this.tagsByNumber[number];
      if (!tag) {
        continue;
      }
      if (this.taggedSubjects.some((candidate) =>
        candidate.label === tag.label
        && candidate.category === tag.category
        && JSON.stringify(candidate.target) === JSON.stringify(target)
      )) {
        continue;
      }
      this.taggedSubjects.push({ ...tag, target });
    }
  }

  addDialogueTags(
    paragraphs: FdxParagraph[],
    turns: DialogueTurn[],
    sceneId: string,
  ): void {
    let turnIndex = -1;
    let partIndex = 0;
    for (const paragraph of paragraphs) {
      if (paragraph.type === 'Character') {
        turnIndex += 1;
        partIndex = 0;
        const turn = turns[turnIndex];
        if (turn) {
          this.addTaggedTarget(paragraph.tagNumbers, {
            type: 'dialogueCue',
            sceneId,
            turnId: turn.id,
          });
        }
        continue;
      }
      if (paragraph.type === 'Dialogue' || paragraph.type === 'Parenthetical') {
        const turn = turns[turnIndex];
        const part = turn?.parts[partIndex];
        if (turn && part) {
          this.addTaggedTarget(paragraph.tagNumbers, {
            type: 'dialoguePart',
            sceneId,
            turnId: turn.id,
            partId: part.id,
          });
        }
        partIndex += 1;
      }
    }
  }

  result(scenes: Scene[]): ScreenplayImportCandidates {
    return {
      characterCues: [...this.cueTurns.entries()].map(([characterName, turnIds]) => ({
        characterName,
        turnIds,
      })),
      sceneHeadings: scenes.map((scene) => ({
        sceneId: scene.id,
        heading: scene.heading,
      })),
      taggedSubjects: this.taggedSubjects,
    };
  }
}
