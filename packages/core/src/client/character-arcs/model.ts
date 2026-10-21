import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { AssetFile } from '../asset-files.js';
import type { CastMemberId } from '../cast-members.js';
import type { ScreenplayAnalysisBeatRole } from '../screenplay-analysis/model.js';
import type { SceneId } from '../screenplay/organization.js';

/**
 * A Character Arc is an agent-authored reading of how one Cast Member changes
 * across the current screenplay. Studio validates its structure and scene
 * references, never what the arc says.
 */
export const CHARACTER_ARC_TYPES = [
  'positiveChange',
  'flat',
  'disillusionment',
  'fall',
  'corruption',
] as const;

export type CharacterArcType = (typeof CHARACTER_ARC_TYPES)[number];

export const CHARACTER_ARC_SPINE_KEYS = [
  'want',
  'need',
  'falseBelief',
  'wound',
  'truthHeld',
  'testedBy',
  'changesOthers',
] as const;

export type CharacterArcSpineKey = (typeof CHARACTER_ARC_SPINE_KEYS)[number];

export interface CharacterArcSpineField {
  text: string;
  sceneIds: SceneId[];
}

export type CharacterArcSpine = Partial<Record<CharacterArcSpineKey, CharacterArcSpineField>> & {
  want: CharacterArcSpineField;
};

/** The worded ends of the arc; `position` places a turning point between them. */
export interface CharacterArcEnds {
  high: string;
  low: string;
}

export interface CharacterArcTurningPoint {
  sceneIds: SceneId[];
  label: string;
  state: string;
  /** Rough place between `ends.low` (-5) and `ends.high` (5). */
  position: number;
  quote?: string;
  /** Character sheet that shows the character at this moment. */
  lookAssetFileId?: string;
}

export interface CharacterArc {
  kind: 'characterArc';
  arcType: CharacterArcType;
  startState: string;
  endState: string;
  ends: CharacterArcEnds;
  spine: CharacterArcSpine;
  turningPoints: CharacterArcTurningPoint[];
}

/** Points an age variant (for example a younger self) at another Cast Member's arc. */
export interface CharacterArcReference {
  kind: 'characterArcReference';
  castMemberId: CastMemberId;
}

export type CharacterArcDocument = CharacterArc | CharacterArcReference;

export interface CharacterArcsWriteDocument {
  kind: 'characterArcs';
  arcs: Array<{ castMemberId: CastMemberId; arc: CharacterArcDocument }>;
}

export type CharacterArcFreshness = 'current' | 'needsRefresh';

export type CharacterArcChange =
  | { type: 'characterArc.written'; castMemberId: CastMemberId }
  | { type: 'characterArc.cleared'; castMemberId: CastMemberId };

interface CharacterArcReportBase {
  valid: true;
  warnings: DiagnosticIssue[];
  project: { id: string; projectName: string };
  resourceKeys: string[];
}

export interface CharacterArcsValidationReport extends CharacterArcReportBase {
  arcCount: number;
}

export interface CharacterArcsWriteReport extends CharacterArcReportBase {
  written: CastMemberId[];
  cleared: CastMemberId[];
  changes: CharacterArcChange[];
}

export interface CharacterArcListItem {
  castMemberId: CastMemberId;
  name: string;
  kind: CharacterArcDocument['kind'];
  arcType?: CharacterArcType;
  sharedWithCastMemberId?: CastMemberId;
  writtenAt: string;
  freshness: CharacterArcFreshness;
}

export interface CharacterArcListReport extends CharacterArcReportBase {
  arcs: CharacterArcListItem[];
}

export interface CharacterArcReadReport extends CharacterArcReportBase {
  castMemberId: CastMemberId;
  arc: CharacterArcDocument;
  writtenAt: string;
  freshness: CharacterArcFreshness;
  freshnessHelp: string | null;
}

/** Whether a Cast Member has an arc, used to decide if the Arc tab shows. */
export type CastMemberCharacterArcSummary =
  | { kind: 'own' }
  | { kind: 'shared'; ownerCastMemberId: CastMemberId; ownerName: string }
  | null;

export interface CastMemberCharacterArcResource {
  castMember: { id: CastMemberId; name: string; role?: string };
  /** The arc shown; for a shared arc, the owner's arc. */
  arc: CharacterArc;
  sharedWith: { ownerCastMemberId: CastMemberId; ownerName: string } | null;
  scenes: Array<{ id: SceneId; productionNumber?: string; heading: string; title?: string }>;
  /** Scenes where the arc's Cast Members appear, from screenplay references. */
  presence: Array<{ sceneId: SceneId; speaks: boolean }>;
  structure: {
    actSegments: Array<{ role: string; title: string; sceneIds: SceneId[] }>;
    keyBeats: Array<{ key: ScreenplayAnalysisBeatRole; sceneId?: SceneId }>;
  } | null;
  /** Character sheets named by turning points. */
  looks: AssetFile[];
  freshness: CharacterArcFreshness;
  freshnessHelp: string | null;
}
