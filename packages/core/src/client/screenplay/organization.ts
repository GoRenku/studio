export type SceneId = string;
export type ScreenplaySectionId = string;
export type ScreenplayStructureEntryId = string;

export interface ScreenplaySection {
  id: ScreenplaySectionId;
  type: 'act' | 'sequence';
  title: string;
  description?: string;
}

export interface ScreenplayStructureEntry {
  id: ScreenplayStructureEntryId;
  parentSectionId?: ScreenplaySectionId;
  content:
    | { type: 'scene'; sceneId: SceneId }
    | { type: 'section'; sectionId: ScreenplaySectionId };
  position: number;
}
