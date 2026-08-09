import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { ProjectId } from '../project/model.js';
import type {
  BlockId,
  DialogueBlockId,
  DialoguePartId,
  DialogueTurnId,
  TextBlockType,
} from './blocks.js';
import type {
  SceneId,
  ScreenplaySectionId,
  ScreenplayStructureEntryId,
} from './organization.js';
import type {
  ScreenplayReferenceId,
  ScreenplaySubject,
  ScreenplayTextRange,
} from './references.js';
import type { ScreenplayRevisionId } from './model.js';

export type AuthoringKey = string;

export type AuthoringIdentity<TId> =
  | { id: TId; key?: never }
  | { id?: never; key: AuthoringKey };

export type TextBlockInput = AuthoringIdentity<BlockId> & {
  type: TextBlockType;
  text: string;
};

export type DialoguePartInput = AuthoringIdentity<DialoguePartId> &
  (
    | { type: 'speech'; text: string }
    | { type: 'parenthetical'; text: string }
  );

export type DialogueTurnInput = AuthoringIdentity<DialogueTurnId> & {
  characterName: string;
  extensions: string[];
  parts: DialoguePartInput[];
};

export type DialogueBlockInput = AuthoringIdentity<DialogueBlockId> & {
  type: 'dialogue';
  characterName: string;
  extensions: string[];
  parts: DialoguePartInput[];
};

export type DualDialogueBlockInput = AuthoringIdentity<BlockId> & {
  type: 'dualDialogue';
  left: DialogueTurnInput;
  right: DialogueTurnInput;
};

export type ScreenplayBlockInput =
  | TextBlockInput
  | DialogueBlockInput
  | DualDialogueBlockInput;

export type SceneInput = AuthoringIdentity<SceneId> & {
  heading: string;
  title?: string;
  blocks: ScreenplayBlockInput[];
};

export type ScreenplaySectionInput = AuthoringIdentity<ScreenplaySectionId> & {
  type: 'act' | 'sequence';
  title: string;
  description?: string;
};

export type SceneReference = AuthoringIdentity<SceneId>;
export type SectionReference = AuthoringIdentity<ScreenplaySectionId>;
export type StructureEntryReference =
  AuthoringIdentity<ScreenplayStructureEntryId>;
export type BlockReference = AuthoringIdentity<BlockId>;
export type DialogueTurnReference = AuthoringIdentity<DialogueTurnId>;
export type DialoguePartReference = AuthoringIdentity<DialoguePartId>;
export type ScreenplayReferenceReference =
  AuthoringIdentity<ScreenplayReferenceId>;

export type ScreenplayStructureEntryInput =
  AuthoringIdentity<ScreenplayStructureEntryId> & {
    parentSection?: SectionReference;
    content:
      | { type: 'scene'; scene: SceneReference }
      | { type: 'section'; section: SectionReference };
    position: number;
  };

export type ScreenplayReferenceTargetInput =
  | { type: 'openingElement'; element: BlockReference }
  | { type: 'scene'; scene: SceneReference }
  | { type: 'sceneHeading'; scene: SceneReference }
  | { type: 'block'; scene: SceneReference; block: BlockReference }
  | {
      type: 'dialogueCue';
      scene: SceneReference;
      turn: DialogueTurnReference;
    }
  | {
      type: 'dialoguePart';
      scene: SceneReference;
      turn: DialogueTurnReference;
      part: DialoguePartReference;
    };

export type ScreenplayReferenceInput =
  AuthoringIdentity<ScreenplayReferenceId> & {
    subject: ScreenplaySubject;
    target: ScreenplayReferenceTargetInput;
    role: 'speaker' | 'setting' | 'mention' | 'presence';
    range?: ScreenplayTextRange;
  };

export interface ScreenplayInput {
  opening: TextBlockInput[];
  scenes: SceneInput[];
  sections: ScreenplaySectionInput[];
  structure: ScreenplayStructureEntryInput[];
  references: ScreenplayReferenceInput[];
}

export type ScreenplayPlacement =
  | { parentSection?: SectionReference; at: 'start' | 'end' }
  | {
      parentSection?: SectionReference;
      beforeEntry: StructureEntryReference;
    }
  | {
      parentSection?: SectionReference;
      afterEntry: StructureEntryReference;
    };

export type ScreenplayOperation =
  | { operation: 'opening.replace'; opening: TextBlockInput[] }
  | {
      operation: 'scene.add';
      scene: SceneInput;
      structureEntryKey: AuthoringKey;
      placement: ScreenplayPlacement;
    }
  | { operation: 'scene.update'; scene: SceneInput }
  | { operation: 'scene.delete'; scene: SceneReference }
  | {
      operation: 'scene.move';
      scene: SceneReference;
      placement: ScreenplayPlacement;
    }
  | {
      operation: 'section.add';
      section: ScreenplaySectionInput;
      structureEntryKey: AuthoringKey;
      placement: ScreenplayPlacement;
    }
  | { operation: 'section.update'; section: ScreenplaySectionInput }
  | { operation: 'section.delete'; section: SectionReference }
  | {
      operation: 'section.move';
      section: SectionReference;
      placement: ScreenplayPlacement;
    }
  | { operation: 'reference.add'; reference: ScreenplayReferenceInput }
  | {
      operation: 'reference.delete';
      reference: ScreenplayReferenceReference;
    };

export interface ScreenplayOperationsInput {
  operations: ScreenplayOperation[];
}

export type GeneratedScreenplayIdentityKind =
  | 'scene'
  | 'block'
  | 'dialogueBlock'
  | 'dialogueTurn'
  | 'dialoguePart'
  | 'section'
  | 'structureEntry'
  | 'reference';

export interface GeneratedScreenplayIdentity {
  kind: GeneratedScreenplayIdentityKind;
  key: AuthoringKey;
  id: string;
}

export interface ScreenplayMutationReport {
  valid: true;
  warnings: DiagnosticIssue[];
  project: { id: ProjectId; projectName: string };
  screenplayRevisionId: ScreenplayRevisionId;
  generatedIdentities: GeneratedScreenplayIdentity[];
  resourceKeys: string[];
}
