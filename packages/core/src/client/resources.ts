import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { Asset } from './assets.js';
import type { CastMember } from './cast-members.js';
import type { CastVoice } from './cast-voices.js';
import type { Location } from './locations.js';
import type {
  Block,
  Scene,
  Screenplay,
  Sequence,
} from './screenplay.js';
import type { ScreenplayAnalysisDocument } from './screenplay-analysis.js';
import type {
  SceneShotListDocument,
} from './scene-shot-list.js';
import type {
  ProjectCounts,
  ProjectCoverImage,
  ProjectInfo,
} from './project.js';
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
  identity: ProjectInfo;
  coverImage: ProjectCoverImage | null;
  languages: ProjectLanguage[];
  cast: CastMember[];
  counts: ProjectCounts;
  navigation: ProjectShellNavigation;
}

export interface ProjectShellNavigation {
  cast: PageResponse<CastNavigationRow>;
  locations: PageResponse<LocationNavigationRow>;
  screenplay: ScreenplayNavigation;
}

export interface ScreenplayNavigation {
  acts: PageResponse<ActNavigationRow>;
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

export interface ActNavigationRow {
  id: string;
  title: string;
  purpose?: string;
  sequenceCount: number;
  sceneCount: number;
}

export interface SequenceNavigationRow {
  id: string;
  actId: string;
  number: number;
  title: string;
  purpose?: string;
  sceneCount: number;
}

export interface SceneNavigationRow {
  id: string;
  sequenceId: string;
  title: string;
  setting?: Scene['setting'];
}

export interface ScreenplayImageReference {
  assetId: string;
  relationshipId: string;
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

export interface StoryArcResource {
  screenplay: Pick<
    Screenplay,
    | 'title'
    | 'logline'
    | 'dramaticQuestion'
    | 'premiseOverview'
    | 'centralConflict'
    | 'summary'
  >;
  acts: StoryArcActResource[];
  activeAnalysis: ScreenplayAnalysisDocument | null;
}

export interface StoryArcActResource extends ActNavigationRow {
  sequences: StoryArcSequenceResource[];
}

export interface StoryArcSequenceResource extends SequenceNavigationRow {
  scenes: StoryArcSceneResource[];
}

export interface StoryArcSceneResource extends SceneNavigationRow {
  storyFunction?: string[];
}

export interface SequenceSceneRow extends SceneNavigationRow {
  storyboardPreview?: SequenceSceneStoryboardPreview;
}

export interface SequenceSceneStoryboardPreview {
  shotListId: string;
  images: Array<{
    shotId: string;
    image: ScreenplayImageReference | null;
  }>;
}

export interface SequenceResource {
  act: ActNavigationRow;
  sequence: SequenceNavigationRow & Pick<Sequence, 'purpose'>;
  scenes: PageResponse<SequenceSceneRow>;
}

export interface SceneShotListResource {
  scene: SceneNavigationRow;
  sequence: SequenceNavigationRow;
  act: ActNavigationRow;
  projectAspectRatio: string | null;
  activeShotListId: string | null;
  activeShotList: SceneShotListDocument | null;
  storyboardImagesByShotId: Record<string, ScreenplayImageReference>;
  castMemberLabels: Record<string, string>;
  castMemberImages: Record<string, ScreenplayImageReference>;
  locationLabels: Record<string, string>;
}

export interface ActStoryboardResource {
  act: ActNavigationRow;
  sequences: ActStoryboardSequence[];
}

export interface ActStoryboardSequence {
  sequence: SequenceNavigationRow;
  scenes: ActStoryboardScene[];
}

export interface ActStoryboardScene {
  scene: SceneNavigationRow;
  shots: ActStoryboardShot[]; // empty -> render one scene placeholder slot
}

export interface ActStoryboardShot {
  shotId: string;
  label: string; // app-derived ('Shot 1')
  title: string;
  image: ScreenplayImageReference | null;
}

export interface SceneNarrativeResource {
  act: ActNavigationRow;
  sequence: SequenceNavigationRow;
  scene: Scene;
  blocks: Block[];
  castMemberLabels: Record<string, string>;
  castMemberImages: Record<string, ScreenplayImageReference>;
  locationLabels: Record<string, string>;
  castMemberHandles: Record<string, string>;
  locationHandles: Record<string, string>;
  dialogueAudio: SceneDialogueAudioWorkspace;
}

export interface CastDesignResource {
  castMember: CastMember;
  assetPage: PageResponse<Asset>;
  countsByRole: CastDesignAssetRoleCount[];
}

export interface CastDesignAssetRoleCount {
  role: string;
  count: number;
}

export interface SceneDesignResource {
  scene: SceneNavigationRow;
  sequence: SequenceNavigationRow;
  assetPage: PageResponse<Asset>;
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
  cardImage: LookbookImage | null;
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
  summary?: string;
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
  agentMedia: import('./agent-media.js').AgentMediaReport;
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
    acts: number;
    sequences: number;
    scenes: number;
    blocks: number;
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
  environmentSheetCount: number;
  missingEnvironmentSheetLocationIds: string[];
  everyLocationHasEnvironmentSheet: boolean;
}

export interface DirectorSceneReadiness {
  sceneId: string;
  shotId: string | null;
  activeShotListId: string | null;
  shotCount: number;
  storyboardStatus:
    | {
        available: false;
        missingShotIds: [];
      }
    | {
        available: true;
        missingShotIds: string[];
  };
  shotVideo: {
    generationAvailable: boolean;
    selectedTakeId: string | null;
    selectedTakeMode: 'continuous' | 'multi-cut' | null;
    selectedShotIds: string[];
  };
}

export type DirectorNextStepId =
  | 'draft-screenplay'
  | 'analyze-screenplay'
  | 'author-production-lookbook'
  | 'author-storyboard-lookbook'
  | 'design-cast'
  | 'design-production'
  | 'design-shot-list'
  | 'generate-storyboards'
  | 'generate-shot-video';

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

export type ScenePanelTab = 'narrative' | 'shots' | 'takes';

export type SceneTakeWorkspaceMode = 'list' | 'new' | 'edit';

export type SceneShotDetailTab =
  | 'description'
  | 'lookbook'
  | 'composition'
  | 'motion'
  | 'dialogs'
  | 'cast'
  | 'location'
  | 'references'
  | 'ai-production';

export type StudioSelection =
  | { type: 'projectInformation' }
  | { type: 'inspiration'; folderId?: string }
  | { type: 'lookbook'; kind: LookbookKind }
  | { type: 'trash' }
  | { type: 'cast' }
  | { type: 'castMember'; id: string }
  | { type: 'locations' }
  | { type: 'location'; id: string }
  | { type: 'storyArc' }
  | { type: 'act'; id: string }
  | { type: 'sequence'; id: string }
  | {
      type: 'scene';
      id: string;
      sceneTab?: ScenePanelTab;
      shotId?: string;
      takeWorkspaceMode?: SceneTakeWorkspaceMode;
      takeId?: string;
      shotTab?: SceneShotDetailTab;
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
  | { surface: 'story-arc'; acts: PageResponse<ActNavigationRow> }
  | { surface: 'act'; act: ActNavigationRow }
  | {
      surface: 'sequence';
      act: ActNavigationRow;
      sequence: SequenceNavigationRow;
    }
  | {
      surface: 'scene';
      act: ActNavigationRow;
      scene: SceneNavigationRow;
      sequence: SequenceNavigationRow;
    };
