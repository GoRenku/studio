import type { Screenplay, ScreenplayRevisionSummary } from './model.js';
import type { SceneId, ScreenplaySection, ScreenplayStructureEntry } from './organization.js';
import type { Scene } from './model.js';
import type { ScreenplayReference } from './references.js';

export interface ScreenplayStructureResource {
  screenplay: Screenplay;
  orderedSceneIds: SceneId[];
}

export interface ScreenplaySectionResource {
  section: ScreenplaySection;
  structure: ScreenplayStructureEntry[];
  orderedSceneIds: SceneId[];
}

export interface ScreenplaySceneResource {
  scene: Scene;
  references: ScreenplayReference[];
}

export interface ScreenplayRevisionListReport {
  revisions: ScreenplayRevisionSummary[];
}

export interface ScreenplayRevisionReadReport {
  revision: ScreenplayRevisionSummary;
  screenplay: Screenplay;
}

export interface ScreenplayStatusReport {
  sourceOwnership: 'renku' | 'fdx';
  counts: {
    openingElements: number;
    sections: number;
    acts: number;
    sequences: number;
    scenes: number;
    blocks: number;
    references: number;
  };
  resourceKeys: string[];
}

export interface SceneProductionNumberReference {
  productionNumber: string;
  sceneId: SceneId;
  heading: string;
  title?: string;
}

export interface SceneProductionNumberListReport {
  project: { id: string; projectName: string };
  sceneNumbers: SceneProductionNumberReference[];
  resourceKeys: string[];
}

export interface SceneProductionNumberResolveReport {
  project: { id: string; projectName: string };
  scene: SceneProductionNumberReference;
  resourceKeys: string[];
}
