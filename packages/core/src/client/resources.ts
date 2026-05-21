import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { Asset } from './assets.js';
import type { CastMember } from './cast-members.js';
import type {
  ProjectCounts,
  ProjectCoverImage,
  ProjectInfo,
} from './project.js';
import type { ProjectLanguage } from './project-languages.js';
import type {
  VisualLanguage,
  VisualLanguageCategory,
} from './visual-language.js';

export interface PageResponse<T> {
  items: T[];
  nextCursor: string | null;
}

export interface ProjectShell {
  identity: ProjectInfo;
  coverImage: ProjectCoverImage | null;
  languages: ProjectLanguage[];
  visualLanguageCategories: VisualLanguageCategory[];
  visualLanguage: VisualLanguage[];
  cast: CastMember[];
  counts: ProjectCounts;
  navigation: ProjectShellNavigation;
}

export interface ProjectShellNavigation {
  cast: PageResponse<CastNavigationRow>;
  visualLanguage: PageResponse<VisualLanguageNavigationRow>;
  screenplay: ScreenplayNavigation;
}

export interface ScreenplayNavigation {
  sequences: PageResponse<SequenceNavigationRow>;
}

export interface CastNavigationRow {
  id: string;
  name: string;
  kind?: string;
  role?: string;
}

export interface VisualLanguageNavigationRow {
  id: string;
  categoryId: string;
  name: string;
  oneLineSummary?: string;
}

export interface SequenceNavigationRow {
  id: string;
  number: number;
  title: string;
  shortTitle?: string;
  sceneCount: number;
}

export interface SceneNavigationRow {
  id: string;
  sequenceId: string;
  title: string;
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

export interface ProjectInformationResource {
  title: string;
  aspectRatio?: string;
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
  | { type: 'visualLanguage' }
  | { type: 'storyboard' }
  | { type: 'sequence'; id: string }
  | { type: 'scene'; id: string }
  | { type: 'casting' }
  | { type: 'cast'; id: string };

export type StudioSelectionContext =
  | { surface: 'project-information' }
  | { surface: 'visual-language' }
  | { surface: 'storyboard' }
  | { surface: 'casting'; cast: PageResponse<CastNavigationRow> }
  | { surface: 'cast-design'; castMember: CastNavigationRow }
  | {
      surface: 'sequence';
      sequence: SequenceNavigationRow;
    }
  | {
      surface: 'scene';
      scene: SceneNavigationRow;
      sequence: SequenceNavigationRow;
    };
