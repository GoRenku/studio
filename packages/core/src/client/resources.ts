import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { AssetPage } from './assets.js';
import type { CastMember } from './cast-members.js';
import type { CastVoice } from './cast-voices.js';
import type { Location } from './locations.js';
import type { Prop } from './props.js';
import type { ScreenplayAnalysis } from './screenplay-analysis/index.js';
import type {
  SceneBeats,
} from './scene-beats/index.js';
import type {
  Project,
} from './project/index.js';
import type { ProjectLanguage } from './project-languages.js';
import type { SceneDialogueAudioWorkspace } from './scene-dialogue-audio-workspace.js';
import type {
  InspirationAnalysis,
  InspirationFolder,
  InspirationFolderListItem,
  InspirationFolderWithResolvedPath,
  InspirationImage,
  Lookbook,
  LookbookImage,
  LookbookSection,
  LookbookSheet,
  LookbookKind,
  VisualLanguageCommandReport,
} from './visual-language.js';

export interface PageResponse<T> {
  items: T[];
  nextCursor: string | null;
}

export interface ProjectShell {
  project: Project;
  languages: ProjectLanguage[];
  navigation: ProjectShellNavigation;
}

export interface ProjectShellNavigation {
  cast: PageResponse<CastNavigationRow>;
  locations: PageResponse<LocationNavigationRow>;
  props: PageResponse<PropNavigationRow>;
  screenplay: import('./screenplay/index.js').ScreenplayStructureResource;
}

export interface CastNavigationRow {
  id: string;
  handle: string;
  name: string;
  role?: string;
  isVoiceOver: boolean;
  firstImage?: ScreenplayImageReference;
}

export interface LocationNavigationRow {
  id: string;
  handle: string;
  name: string;
  timePeriod?: string;
  firstImage?: ScreenplayImageReference;
}

export interface PropNavigationRow {
  id: string;
  handle: string;
  name: string;
  firstImage?: ScreenplayImageReference;
}

export interface ScreenplayImageReference {
  assetId: string;
  assetFileId: string;
  title: string;
  fileRole: string;
  mediaKind: string;
  mimeType: string | null;
  width: number | null;
  height: number | null;
}

export interface ScreenplayImageReferenceWithHttp
  extends ScreenplayImageReference {
  url: string;
}

export interface CastOverviewResource {
  cast: PageResponse<CastNavigationRow>;
}

export interface CastMemberResource {
  castMember: CastMember;
  firstImage?: ScreenplayImageReference;
  voices: CastVoice[];
}

export interface LocationOverviewResource {
  locations: PageResponse<LocationNavigationRow>;
}

export interface LocationResource {
  location: Location;
  firstImage?: ScreenplayImageReference;
}

export interface PropOverviewResource {
  props: PageResponse<PropNavigationRow>;
}

export interface PropResource {
  prop: Prop;
  firstImage?: ScreenplayImageReference;
}

export interface StoryArcResource {
  project: {
    title: string;
    logline?: string;
    dramaticQuestion?: string;
    premise?: string;
    centralConflict?: string;
    synopsis?: string;
  };
  scenes: StoryArcScene[];
  activeAnalysis: ScreenplayAnalysis | null;
}

export interface StoryArcScene {
  id: string;
  productionNumber?: string;
  heading: string;
  title?: string;
}

export interface SequenceSceneStoryboardPreview {
  sceneBeatsRevisionId: string;
  images: Array<{
    beatId: string;
    image: ScreenplayImageReference | null;
  }>;
}

export interface SceneBeatsResource {
  scene: import('./screenplay/index.js').ScreenplaySceneResource;
  sections: import('./screenplay/index.js').ScreenplaySection[];
  projectAspectRatio: string | null;
  activeRevisionId: string | null;
  activeRevision: SceneBeats | null;
  storyboardImagesByBeatId: Record<string, ScreenplayImageReference>;
  castMemberLabels: Record<string, string>;
  castMemberImages: Record<string, ScreenplayImageReference>;
  locationLabels: Record<string, string>;
  propLabels: Record<string, string>;
}

export interface SceneNarrativeResource {
  scene: import('./screenplay/index.js').ScreenplaySceneResource;
  sections: import('./screenplay/index.js').ScreenplaySection[];
  castMemberLabels: Record<string, string>;
  castMemberImages: Record<string, ScreenplayImageReference>;
  locationLabels: Record<string, string>;
  locationImages: Record<string, ScreenplayImageReference>;
  dialogueAudio: SceneDialogueAudioWorkspace;
}

export interface SceneDesignResource {
  scene: import('./screenplay/index.js').ScreenplaySceneResource;
  assetPage: AssetPage;
}

export interface InspirationResource {
  folders: PageResponse<InspirationFolderListItem>;
}

export interface InspirationFolderResource {
  folder: InspirationFolder;
  images: InspirationImage[];
  analysis: InspirationAnalysis | null;
}

export interface LookbookResource extends VisualLanguageCommandReport {
  lookbook: Lookbook;
  sourceInspirationFolders: InspirationFolderWithResolvedPath[];
  selectedImageId: string | null;
  images: LookbookImage[];
  sheets: LookbookSheet[];
  imagesBySection: Record<LookbookSection, LookbookImage[]>;
  /** Images anchored to a specific point (pattern/observation), keyed by point id. */
  imagesByPoint: Record<string, LookbookImage[]>;
}

export interface ProjectLookbooksResource extends VisualLanguageCommandReport {
  production: LookbookResource | null;
  storyboard: LookbookResource | null;
}

export interface ProjectInformationResource {
  title: string;
  aspectRatio: string;
  logline?: string;
  synopsis?: string;
  premise?: string;
  intendedAudience?: string;
  format?: string;
  targetRuntimeMinutes?: number;
  primaryGenre?: string;
  secondaryGenres?: string[];
  tones?: string[];
  contentRatingIntent?: string;
  creativeBoundaries?: string[];
  centralConflict?: string;
  dramaticQuestion?: string;
  themes?: string[];
  historicalBasis?: string[];
  dramatizedElements?: string[];
  screenplayDraftStatus?: string;
  researchSources?: string[];
  assumptions?: string[];
  openQuestions?: string[];
  nextSteps?: string[];
  languages: ProjectLanguage[];
}

export interface DirectorContextReport {
  valid: true;
  project: {
    name: string;
    id: string;
    title: string;
    aspectRatio: string;
  };
  currentSelection: StudioSelectionContextResult | null;
  screenplay: DirectorScreenplayReadiness;
  visualLanguage: DirectorVisualLanguageReadiness;
  cast: DirectorCastReadiness;
  productionDesign: DirectorProductionDesignReadiness;
  selectedScene: DirectorSceneReadiness | null;
  projectSettings: import('./project-settings.js').ProjectSettingsDocument;
  nextSteps: DirectorNextStep[];
  resourceKeys: string[];
  diagnostics: DiagnosticIssue[];
  warnings: DiagnosticIssue[];
}

export interface DirectorScreenplayReadiness {
  exists: boolean;
  activeAnalysisId: string | null;
  analysisCount: number;
  counts: {
    castMembers: number;
    locations: number;
    openingElements: number;
    sections: number;
    acts: number;
    sequences: number;
    scenes: number;
    blocks: number;
    references: number;
  };
}

export interface DirectorVisualLanguageReadiness {
  inspirationFolderCount: number;
  lookbookCount: number;
  productionLookbookId: string | null;
  storyboardLookbookId: string | null;
  productionLookbookReadyForGeneration: boolean;
  storyboardLookbookReadyForGeneration: boolean;
}

export interface DirectorCastReadiness {
  castMemberCount: number;
  activeCastDesignCount: number;
  missingActiveCastDesignCastMemberIds: string[];
  visualReferenceCount: number;
  missingVisualReferenceCastMemberIds: string[];
  everyCastMemberHasVisualReference: boolean;
}

export interface DirectorProductionDesignReadiness {
  locationCount: number;
  activeLocationDesignCount: number;
  missingActiveLocationDesignLocationIds: string[];
  locationSheetCount: number;
  missingEnvironmentSheetLocationIds: string[];
  everyLocationHasEnvironmentSheet: boolean;
  propCount: number;
  activePropDesignCount: number;
  missingActivePropDesignPropIds: string[];
  propSheetCount: number;
  missingPropSheetPropIds: string[];
  everyPropHasPropSheet: boolean;
}

export interface DirectorSceneReadiness {
  sceneId: string;
  beatId: string | null;
  activeRevisionId: string | null;
  beatCount: number;
  storyboardStatus:
    | {
        available: false;
        missingBeatIds: [];
      }
    | {
        available: true;
        missingBeatIds: string[];
  };
}

export type DirectorNextStepId =
  | 'draft-screenplay'
  | 'analyze-screenplay'
  | 'author-production-lookbook'
  | 'author-storyboard-lookbook'
  | 'design-cast'
  | 'design-production'
  | 'design-props'
  | 'design-scene-beats'
  | 'generate-storyboards';

export interface DirectorNextStep {
  id: DirectorNextStepId;
  title: string;
  specialistSkill: string;
  reason: string;
  command: string | null;
}

export type StudioSelectionContextResult =
  | {
      valid: true;
      selection: StudioSelection;
      context: StudioSelectionContext;
      resourceKeys: string[];
    }
  | {
      valid: false;
      reason: 'selectionNotFound' | 'unsupportedSelection';
      diagnostics: DiagnosticIssue[];
};

export type ScenePanelTab =
  | 'narrative'
  | 'beats'
  | 'shotPlans'
  | 'generations';

export type StudioSelection =
  | { type: 'projectInformation' }
  | { type: 'inspiration'; folderId?: string }
  | { type: 'lookbook'; kind: LookbookKind }
  | { type: 'trash' }
  | { type: 'cast' }
  | { type: 'castMember'; id: string }
  | { type: 'locations' }
  | { type: 'location'; id: string }
  | { type: 'props' }
  | { type: 'prop'; id: string }
  | { type: 'storyArc' }
  | { type: 'section'; id: string }
  | {
      type: 'scene';
      id: string;
      sceneTab?: ScenePanelTab;
      beatId?: string;
      shotPlanId?: string;
      shotId?: string;
    };

export type StudioSelectionContext =
  | { surface: 'project-information' }
  | { surface: 'trash' }
  | { surface: 'visual-language-inspiration' }
  | { surface: 'visual-language-lookbook' }
  | { surface: 'cast'; cast: PageResponse<CastNavigationRow> }
  | { surface: 'cast-member'; castMember: CastNavigationRow }
  | { surface: 'locations'; locations: PageResponse<LocationNavigationRow> }
  | { surface: 'location'; location: LocationNavigationRow }
  | { surface: 'props'; props: PageResponse<PropNavigationRow> }
  | { surface: 'prop'; prop: PropNavigationRow }
  | { surface: 'story-arc' }
  | { surface: 'section'; section: import('./screenplay/index.js').ScreenplaySectionResource }
  | {
      surface: 'scene';
      scene: import('./screenplay/index.js').ScreenplaySceneResource;
    };
