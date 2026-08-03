export type BlockId = string;
export type DialogueTurnId = string;
export type DialogueBlockId = BlockId & DialogueTurnId;
export type DialoguePartId = string;

export type TextBlockType =
  | 'action'
  | 'transition'
  | 'shot'
  | 'lyrics'
  | 'castList'
  | 'note'
  | 'specialHeading'
  | 'titleCard'
  | 'super';

export interface TextBlock {
  id: BlockId;
  type: TextBlockType;
  text: string;
}

export interface DialogueBlock {
  id: DialogueBlockId;
  type: 'dialogue';
  characterName: string;
  extensions: string[];
  parts: DialoguePart[];
}

export interface DualDialogueBlock {
  id: BlockId;
  type: 'dualDialogue';
  left: DialogueTurn;
  right: DialogueTurn;
}

export interface DialogueTurn {
  id: DialogueTurnId;
  characterName: string;
  extensions: string[];
  parts: DialoguePart[];
}

export type DialoguePart =
  | { id: DialoguePartId; type: 'speech'; text: string }
  | { id: DialoguePartId; type: 'parenthetical'; text: string };

export type ScreenplayBlock = TextBlock | DialogueBlock | DualDialogueBlock;
export type OpeningElement = TextBlock;
