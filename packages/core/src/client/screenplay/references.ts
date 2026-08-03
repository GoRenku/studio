import type { CastMemberId } from '../cast-members.js';
import type { LocationId } from '../locations.js';
import type { PropId } from '../props.js';
import type {
  BlockId,
  DialoguePartId,
  DialogueTurnId,
} from './blocks.js';
import type { SceneId } from './organization.js';

export type ScreenplayReferenceId = string;

export type ScreenplaySubject =
  | { type: 'castMember'; id: CastMemberId }
  | { type: 'location'; id: LocationId }
  | { type: 'prop'; id: PropId };

export type ScreenplayReferenceTarget =
  | { type: 'openingElement'; elementId: BlockId }
  | { type: 'scene'; sceneId: SceneId }
  | { type: 'sceneHeading'; sceneId: SceneId }
  | { type: 'block'; sceneId: SceneId; blockId: BlockId }
  | { type: 'dialogueCue'; sceneId: SceneId; turnId: DialogueTurnId }
  | {
      type: 'dialoguePart';
      sceneId: SceneId;
      turnId: DialogueTurnId;
      partId: DialoguePartId;
    };

export interface ScreenplayTextRange {
  start: number;
  length: number;
}

export interface ScreenplayReference {
  id: ScreenplayReferenceId;
  subject: ScreenplaySubject;
  target: ScreenplayReferenceTarget;
  role: 'speaker' | 'setting' | 'mention' | 'presence';
  range?: ScreenplayTextRange;
}
