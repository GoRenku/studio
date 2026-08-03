import type {
  OpeningElement,
  ScreenplayBlock,
} from './blocks.js';
import type {
  SceneId,
  ScreenplaySection,
  ScreenplayStructureEntry,
} from './organization.js';
import type { ScreenplayReference } from './references.js';

export type ScreenplayRevisionId = string;

export interface Scene {
  id: SceneId;
  productionNumber?: string;
  heading: string;
  title?: string;
  blocks: ScreenplayBlock[];
}

export interface Screenplay {
  opening: OpeningElement[];
  scenes: Scene[];
  sections: ScreenplaySection[];
  structure: ScreenplayStructureEntry[];
  references: ScreenplayReference[];
}

export interface ScreenplayRevisionSummary {
  id: ScreenplayRevisionId;
  sourceCommand: string;
  summary: string | null;
  createdAt: string;
}
