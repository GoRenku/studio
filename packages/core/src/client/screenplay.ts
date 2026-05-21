import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';

export interface Reference {
  id?: string;
  localKey?: string;
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
  historicalBasis?: unknown[];
  dramatizedElements?: unknown[];
  structureModel?: string;
  status?: string;
  researchSources?: unknown[];
  assumptionsMade?: unknown[];
}

export interface CastMember {
  id?: string;
  localKey?: string;
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
  localKey?: string;
  name: string;
  timePeriod?: string;
  description?: string;
  visualNotes?: string;
}

export interface Act {
  id?: string;
  localKey?: string;
  title?: string;
  purpose?: string;
  keyBeats?: unknown[];
  sequences: Sequence[];
}

export interface Sequence {
  id?: string;
  localKey?: string;
  title?: string;
  purpose?: string;
  scenes: Scene[];
}

export interface SceneSetting {
  interiorExterior?: string;
  timeOfDay?: string;
  locationRefs?: Reference[];
  locationIds?: string[];
}

export interface Scene {
  id?: string;
  localKey?: string;
  title: string;
  setting: SceneSetting;
  storyFunction?: string[];
  blocks: Block[];
}

export type Block = ActionBlock | DialogueBlock;

export interface ActionBlock {
  id?: string;
  localKey?: string;
  type: 'action';
  text: string;
  castMemberRefs?: Reference[];
  locationRefs?: Reference[];
  castMemberIds?: string[];
  locationIds?: string[];
}

export interface DialogueBlock {
  id?: string;
  localKey?: string;
  type: 'dialogue';
  castMemberRef?: Reference;
  castMemberId?: string;
  extension?: string;
  parenthetical?: string;
  lines: string[];
  castMemberRefs?: Reference[];
  locationRefs?: Reference[];
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

export interface Placement {
  beforeId?: string;
  afterId?: string;
}

export type ScreenplayOperation =
  | { operation: 'castMember.add'; castMember: CastMember; placement?: Placement }
  | { operation: 'castMember.update'; castMember: CastMember }
  | { operation: 'castMember.delete'; castMemberId: string }
  | { operation: 'castMember.move'; castMemberId: string; placement: Placement }
  | { operation: 'location.add'; location: Location; placement?: Placement }
  | { operation: 'location.update'; location: Location }
  | { operation: 'location.delete'; locationId: string }
  | { operation: 'location.move'; locationId: string; placement: Placement }
  | { operation: 'act.add'; act: Act; placement?: Placement }
  | { operation: 'act.update'; act: Act }
  | { operation: 'act.delete'; actId: string }
  | { operation: 'act.move'; actId: string; placement: Placement }
  | { operation: 'sequence.add'; actId: string; sequence: Sequence; placement?: Placement }
  | { operation: 'sequence.update'; sequence: Sequence }
  | { operation: 'sequence.delete'; sequenceId: string }
  | { operation: 'sequence.move'; sequenceId: string; actId?: string; placement: Placement }
  | { operation: 'scene.add'; sequenceId: string; scene: Scene; placement?: Placement }
  | { operation: 'scene.update'; scene: Scene }
  | { operation: 'scene.delete'; sceneId: string }
  | { operation: 'scene.move'; sceneId: string; sequenceId?: string; placement: Placement };

export interface ScreenplayOperationDocument {
  kind: 'screenplayOperations';
  operations: ScreenplayOperation[];
}

export interface GeneratedId {
  kind: string;
  path: string[];
  localKey: string;
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
