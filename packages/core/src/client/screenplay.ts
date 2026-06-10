import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';

export interface Reference {
  id?: string;
  key?: string;
}

export interface Screenplay {
  title: string;
  intendedAudience?: string;
  targetLengthLabel?: string;
  estimatedMinutes?: number;
  genrePrimary?: string;
  genreSecondary?: string[];
  tone?: string[];
  ratingIntent?: string;
  boundaries?: string[];
  logline?: string;
  summary?: string;
  premiseOverview?: string;
  centralConflict?: string;
  dramaticQuestion?: string;
  themes?: string[];
  historicalBasis?: string[];
  dramatizedElements?: string[];
  status?: string;
  researchSources?: string[];
  assumptionsMade?: string[];
}

export interface CastMember {
  id?: string;
  key?: string;
  handle: string;
  name: string;
  role?: string;
  age?: number;
  want?: string;
  need?: string;
  arc?: string;
  voiceNotes?: string;
  description?: string;
}

export interface Location {
  id?: string;
  key?: string;
  handle: string;
  name: string;
  timePeriod?: string;
  description?: string;
  visualNotes?: string;
}

export interface Act {
  id?: string;
  key?: string;
  title?: string;
  purpose?: string;
  sequences: Sequence[];
}

export interface Sequence {
  id?: string;
  key?: string;
  title?: string;
  purpose?: string;
  scenes: Scene[];
}

export interface SceneSetting {
  interiorExterior?: string;
  timeOfDay?: string;
  locationReferences?: Reference[];
  locationIds?: string[];
}

export interface Scene {
  id?: string;
  key?: string;
  title: string;
  setting: SceneSetting;
  storyFunction?: string[];
  blocks: Block[];
}

export type Block = ActionBlock | DialogueBlock;
export type TextBlockType =
  | 'action'
  | 'parenthetical'
  | 'transition'
  | 'special_heading'
  | 'title_card'
  | 'super'
  | 'shot'
  | 'note';

export interface ActionBlock {
  type: TextBlockType;
  text: string;
  render?: boolean;
  castMemberReferences?: Reference[];
  locationReferences?: Reference[];
  castMemberIds?: string[];
  locationIds?: string[];
}

export interface DialogueBlock {
  dialogueId: string;
  type: 'dialogue';
  castMemberReference?: Reference;
  castMemberId?: string;
  extension?: string;
  parenthetical?: string;
  lines: string[];
  castMemberReferences?: Reference[];
  locationReferences?: Reference[];
  castMemberIds?: string[];
  locationIds?: string[];
}

export interface ScreenplayDocument {
  kind: 'screenplay';
  screenplay: Screenplay;
  cast: CastMember[];
  locations: Location[];
  acts: Act[];
}

export interface ScreenplayCreateDocument extends Omit<ScreenplayDocument, 'kind'> {
  kind: 'screenplayCreate';
}

export interface Placement {
  beforeId?: string;
  afterId?: string;
  position?: 'only';
}

export type ScreenplayOperation =
  | { operation: 'screenplay.update'; screenplay: Screenplay }
  | { operation: 'act.add'; act: Act; placement?: Placement }
  | { operation: 'act.update'; act: Act }
  | { operation: 'act.delete'; actId: string }
  | { operation: 'act.move'; actId: string; placement: Placement }
  | { operation: 'sequence.add'; actId: string; sequence: Sequence; placement?: Placement }
  | { operation: 'sequence.update'; sequence: Sequence }
  | { operation: 'sequence.delete'; sequenceId: string }
  | { operation: 'sequence.move'; sequenceId: string; fromActId: string; toActId: string; placement: Placement }
  | { operation: 'scene.add'; sequenceId: string; scene: Scene; placement?: Placement }
  | { operation: 'scene.update'; scene: Scene }
  | { operation: 'scene.delete'; sceneId: string }
  | { operation: 'scene.move'; sceneId: string; fromSequenceId: string; toSequenceId: string; placement: Placement };

export interface ScreenplayOperationDocument {
  kind: 'screenplayOperations';
  operations: ScreenplayOperation[];
}

export interface ScreenplaySceneRevisionDocument {
  kind: 'screenplaySceneRevision';
  scene: Scene;
}

export interface GeneratedId {
  kind: string;
  path: string[];
  key: string;
  id: string;
}

export interface ScreenplayCommandChange {
  operation: string;
  [key: string]: string;
}

export interface ScreenplayProjectSummary {
  name: string;
  id?: string;
}

export interface ScreenplayCommandReport {
  valid: true;
  warnings: DiagnosticIssue[];
  project: ScreenplayProjectSummary;
  changes?: ScreenplayCommandChange[];
  generatedIds?: GeneratedId[];
  resourceKeys?: string[];
  shotListImpacts?: ScreenplayShotListImpact[];
}

export interface ScreenplayShotListImpact {
  sceneId: string;
  activeShotListId: string | null;
  changedBlockIndexes: number[];
  deletedBlockIndexes: number[];
  insertedBlockIndexes: number[];
  uncoveredBlockIndexes: number[];
  shotsReferencingChangedBlocks: string[];
  shotsReferencingDeletedBlocks: string[];
  suggestedNextCommand: string | null;
}

export interface ScreenplayRevisionSummary {
  id: string;
  sourceCommand: string;
  summary: string | null;
  createdAt: string;
}

export interface ScreenplayRevisionListReport extends ScreenplayCommandReport {
  revisions: ScreenplayRevisionSummary[];
}

export interface ScreenplayRevisionReadReport extends ScreenplayCommandReport {
  revision: ScreenplayRevisionSummary;
  screenplay: ScreenplayDocument;
}

export interface ScreenplayReadReport extends ScreenplayCommandReport {
  screenplay: ScreenplayDocument | null;
}

export interface ScreenplayStatusReport extends ScreenplayCommandReport {
  exists: boolean;
  counts: {
    castMembers: number;
    locations: number;
    acts: number;
    sequences: number;
    scenes: number;
    blocks: number;
  };
  resourceKeys: string[];
}
