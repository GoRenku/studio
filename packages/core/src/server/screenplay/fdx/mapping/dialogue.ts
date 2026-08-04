import type {
  DialogueBlock,
  DialoguePart,
  DialogueTurn,
  ScreenplayBlock,
} from '../../../../client/screenplay/index.js';
import type { FdxIdentityFactory } from '../identifiers.js';
import type {
  FdxDualDialogue,
  FdxParagraph,
  FdxSyntaxDocument,
} from '../parser/types.js';
import { invalidFdxAt, invalidFdxParagraph } from './errors.js';

export function mapFdxDialogueTurn(
  content: FdxSyntaxDocument['content'],
  characterCursor: number,
  identities: FdxIdentityFactory,
): { turn: DialogueTurn; nextCursor: number } {
  const cue = content[characterCursor];
  if (!cue || cue.kind !== 'paragraph' || cue.type !== 'Character') {
    throw invalidFdxAt('FinalDraft/Content', 'Dialogue turn requires a Character paragraph');
  }
  const { characterName, extensions } = parseCharacterCue(cue);
  const parts: DialoguePart[] = [];
  let cursor = characterCursor + 1;
  while (cursor < content.length) {
    const paragraph = content[cursor];
    if (paragraph.kind !== 'paragraph'
      || (paragraph.type !== 'Dialogue' && paragraph.type !== 'Parenthetical')) {
      break;
    }
    const text = paragraph.type === 'Parenthetical'
      ? stripOuterParentheses(paragraph.text)
      : paragraph.text;
    if (!text.trim()) {
      cursor += 1;
      continue;
    }
    parts.push({
      id: identities.id('screenplay_dialogue_part', `${paragraph.path}/part`),
      type: paragraph.type === 'Dialogue' ? 'speech' : 'parenthetical',
      text,
    });
    cursor += 1;
  }
  if (!parts.some((part) => part.type === 'speech')) {
    throw invalidFdxParagraph(cue, 'Character cue has no Dialogue speech');
  }
  return {
    turn: {
      id: identities.id('scene_dialogue', `${cue.path}/turn`),
      characterName,
      extensions,
      parts,
    },
    nextCursor: cursor - 1,
  };
}

export function mapFdxDualDialogue(
  dual: FdxDualDialogue,
  identities: FdxIdentityFactory,
): Extract<ScreenplayBlock, { type: 'dualDialogue' }> {
  const content: FdxSyntaxDocument['content'] = dual.paragraphs;
  const left = mapFdxDialogueTurn(content, 0, identities);
  const right = mapFdxDialogueTurn(content, left.nextCursor + 1, identities);
  if (right.nextCursor !== content.length - 1) {
    throw invalidFdxAt(dual.path, 'DualDialogue must contain exactly two complete turns');
  }
  return {
    id: identities.id('screenplay_block', `${dual.path}/block`),
    type: 'dualDialogue',
    left: left.turn,
    right: right.turn,
  };
}

export function dialogueTurnAsBlock(turn: DialogueTurn): DialogueBlock {
  return { ...turn, type: 'dialogue' };
}

export function dialogueBlockAsTurn(block: DialogueBlock): DialogueTurn {
  return {
    id: block.id,
    characterName: block.characterName,
    extensions: block.extensions,
    parts: block.parts,
  };
}

function parseCharacterCue(paragraph: FdxParagraph): {
  characterName: string;
  extensions: string[];
} {
  let remaining = paragraph.text.trim();
  const extensions: string[] = [];
  while (remaining.endsWith(')')) {
    const match = remaining.match(/\s*\(([^()]*)\)\s*$/u);
    if (!match || !match[1].trim()) {
      break;
    }
    extensions.unshift(match[1].trim());
    remaining = remaining.slice(0, match.index).trimEnd();
  }
  if (!remaining) {
    throw invalidFdxParagraph(paragraph, 'Character cue has no name');
  }
  return { characterName: remaining, extensions };
}

function stripOuterParentheses(text: string): string {
  const trimmed = text.trim();
  return trimmed.startsWith('(') && trimmed.endsWith(')')
    ? trimmed.slice(1, -1)
    : trimmed;
}
