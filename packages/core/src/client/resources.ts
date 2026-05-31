import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { Asset } from './assets.js';
import type { CastMember } from './cast-members.js';
import type { Location } from './locations.js';
import type {
  Block,
  Scene,
  Screenplay,
  Sequence,
} from './screenplay.js';
import type { ScreenplayAnalysisDocument } from './screenplay-analysis.js';
import type { SceneShotListDocument } from './scene-shot-list.js';
import type {
  ProjectCounts,
  ProjectCoverImage,
  ProjectInfo,
} from './project.js';
import type { ProjectLanguage } from './project-languages.js';
import type {
  InspirationAnalysis,
  InspirationFolder,
  InspirationFolderListItem,
  InspirationFolderWithResolvedPath,
  InspirationImage,
  Lookbook,
  LookbookImage,
  LookbookListItemWithSources,
  LookbookSection,
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
  // Active storyboard sheet ('sheet' file) for the scene, if any.
  storyboardSheet?: ScreenplayImageReference;
}

export interface SequenceResource {
  act: ActNavigationRow;
  sequence: SequenceNavigationRow & Pick<Sequence, 'purpose'>;
  scenes: PageResponse<SequenceSceneRow>;
}

export interface SceneStoryboardSheetReference {
  shotListId: string;
  sheet: ScreenplayImageReference; // original sheet file (role 'sheet')
}

export interface SceneShotListResource {
  scene: SceneNavigationRow;
  sequence: SequenceNavigationRow;
  act: ActNavigationRow;
  projectAspectRatio: string | null;
  activeShotList: SceneShotListDocument | null;
  storyboardSheet: SceneStoryboardSheetReference | null;
  storyboardImagesByShotId: Record<string, ScreenplayImageReference>;
  castMemberLabels: Record<string, string>;
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
  locationLabels: Record<string, string>;
  castMemberHandles: Record<string, string>;
  locationHandles: Record<string, string>;
}

export interface CastDesignResource {
  castMember: CastMember;
  selectedAssets: Asset[];
  activeTakePage: PageResponse<Asset>;
  countsByRole: CastDesignAssetRoleCount[];
}

export interface CastDesignAssetRoleCount {
  role: string;
  selectedCount: number;
  takeCount: number;
}

export interface SceneDesignResource {
  scene: SceneNavigationRow;
  sequence: SequenceNavigationRow;
  selectedAssets: Asset[];
  activeTakePage: PageResponse<Asset>;
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
  isActive: boolean;
  images: LookbookImage[];
  imagesBySection: Record<LookbookSection, LookbookImage[]>;
}

export interface LookbooksResource extends VisualLanguageCommandReport {
  activeLookbookId: string | null;
  lookbooks: LookbookListItemWithSources[];
}

export interface ProjectInformationResource {
  title: string;
  aspectRatio: string;
  logline?: string;
  summary?: string;
  languages: ProjectLanguage[];
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

export type StudioSelection =
  | { type: 'projectInformation' }
  | { type: 'inspiration'; folderId?: string }
  | { type: 'lookbooks' }
  | { type: 'lookbook'; lookbookId: string }
  | { type: 'cast' }
  | { type: 'castMember'; id: string }
  | { type: 'locations' }
  | { type: 'location'; id: string }
  | { type: 'storyArc' }
  | { type: 'act'; id: string }
  | { type: 'sequence'; id: string }
  | { type: 'scene'; id: string; shotId?: string };

export type StudioSelectionContext =
  | { surface: 'project-information' }
  | { surface: 'visual-language-inspiration' }
  | { surface: 'visual-language-lookbooks' }
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
