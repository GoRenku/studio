import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { Asset } from './assets.js';
import type { CastMember } from './cast-members.js';
import type { Location } from './locations.js';
import type { ProjectLanguage } from './project-languages.js';
import type {
  Block,
  Scene,
  Screenplay,
} from './screenplay.js';
import type {
  Lookbook,
  LookbookImage,
} from './visual-language.js';

export interface DepartmentProjectSummary {
  name: string;
  id?: string;
  projectFolder?: string;
  title?: string;
  aspectRatio?: string | null;
  logline?: string | null;
  summary?: string | null;
  languages?: ProjectLanguage[];
}

export interface DepartmentGeneratedId {
  kind: string;
  path: string[];
  key: string;
  id: string;
}

export interface DepartmentCommandChange {
  operation: string;
  [key: string]: string | number | boolean | null;
}

export interface DepartmentCommandReport {
  valid: true;
  warnings: DiagnosticIssue[];
  project: DepartmentProjectSummary;
  changes?: DepartmentCommandChange[];
  generatedIds?: DepartmentGeneratedId[];
  resourceKeys: string[];
}

export interface CastMemberInput {
  id?: string;
  key?: string;
  handle: string;
  name: string;
  role?: string;
  isVoiceOver?: boolean;
  age?: number;
  want?: string;
  need?: string;
  arc?: string;
  voiceNotes?: string;
  description?: string;
}

export type CastOperation =
  | { operation: 'castMember.add'; castMember: CastMemberInput; placement?: DepartmentPlacement }
  | { operation: 'castMember.update'; castMember: CastMemberInput }
  | { operation: 'castMember.delete'; castMemberId: string }
  | { operation: 'castMember.move'; castMemberId: string; placement: DepartmentPlacement };

export interface CastOperationDocument {
  kind: 'castOperations';
  operations: CastOperation[];
}

export interface LocationInput {
  id?: string;
  key?: string;
  handle: string;
  name: string;
  timePeriod?: string;
  description?: string;
  visualNotes?: string;
}

export type LocationOperation =
  | { operation: 'location.add'; location: LocationInput; placement?: DepartmentPlacement }
  | { operation: 'location.update'; location: LocationInput }
  | { operation: 'location.delete'; locationId: string }
  | { operation: 'location.move'; locationId: string; placement: DepartmentPlacement };

export interface LocationOperationDocument {
  kind: 'locationOperations';
  operations: LocationOperation[];
}

export interface DepartmentPlacement {
  beforeId?: string;
  afterId?: string;
  position?: 'only';
}

export type CastDesignScope =
  | { kind: 'project' }
  | { kind: 'sequence'; sequenceId: string }
  | { kind: 'scene'; sceneId: string };

export interface CastInterpretation {
  roleUnderstanding: string;
  audienceRead: string[];
  contradictions: string[];
}

export interface CastAppearanceDesign {
  ageRead?: string;
  build?: string;
  face?: string;
  posture?: string;
  movement?: string;
  grooming?: string;
  silhouette?: string;
}

export interface CastPerformanceDesign {
  behavioralPressure: string[];
  stillness: string[];
  gesture: string[];
  statusShifts: string[];
  sceneEnergy: string[];
}

export interface CastCostumeVariant {
  label: string;
  scope: CastDesignScope;
  wardrobe: string[];
  continuityNotes?: string[];
}

export interface CastCostumeDesign {
  baseWardrobeLogic: string[];
  variants: CastCostumeVariant[];
}

export interface CastVoiceCastingDesign {
  voiceIdentity: string;
  accent?: string;
  tempo?: string;
  texture?: string;
  emotionalRange?: string[];
  localeNotes?: string[];
}

export interface CastContinuityGuidance {
  mustRemainConsistent: string[];
  canChange: string[];
}

export interface CastGenerationGuidance {
  characterSheetPositive: string[];
  characterSheetNegative: string[];
  profilePositive: string[];
  profileNegative: string[];
  futureCostumeMediaNotes?: string[];
  futureVoiceMediaNotes?: string[];
}

export interface CastDesignDocument {
  kind: 'castDesign';
  castMemberId: string;
  title?: string;
  design: {
    interpretation: CastInterpretation;
    appearance: CastAppearanceDesign;
    performance: CastPerformanceDesign;
    costume: CastCostumeDesign;
    voiceCasting?: CastVoiceCastingDesign;
    continuity: CastContinuityGuidance;
    generationGuidance: CastGenerationGuidance;
  };
  openQuestions?: string[];
}

export interface ProductionDesignProp {
  name: string;
  description: string;
  continuityNotes?: string[];
}

export interface LocationDesignDocument {
  kind: 'locationDesign';
  locationId: string;
  title?: string;
  design: {
    spatialThesis: string;
    architecture: string[];
    setDressing: string[];
    materialsAndSurfaces: string[];
    atmosphere: string[];
    propsAndRecurringObjects: ProductionDesignProp[];
    continuity: string[];
    environmentSheetGuidance: string[];
    generationGuidance: string[];
  };
  openQuestions?: string[];
}

export interface DepartmentDocumentSummary {
  id: string;
  ownerId: string;
  title: string | null;
  createdAt: string;
  isActive: boolean;
  sourceCommand: string | null;
}

export interface CastDesignListReport extends DepartmentCommandReport {
  castMember: CastMember;
  designs: DepartmentDocumentSummary[];
  activeDesignId: string | null;
}

export interface CastDesignReadReport extends DepartmentCommandReport {
  castMember: CastMember;
  design: CastDesignDocument | null;
  summary: DepartmentDocumentSummary | null;
  activeDesignId: string | null;
}

export interface CastDesignWriteReport extends DepartmentCommandReport {
  castMember: CastMember;
  design: CastDesignDocument;
  designId: string;
  activeDesignId: string;
}

export interface LocationDesignListReport extends DepartmentCommandReport {
  location: Location;
  designs: DepartmentDocumentSummary[];
  activeDesignId: string | null;
}

export interface LocationDesignReadReport extends DepartmentCommandReport {
  location: Location;
  design: LocationDesignDocument | null;
  summary: DepartmentDocumentSummary | null;
  activeDesignId: string | null;
}

export interface LocationDesignWriteReport extends DepartmentCommandReport {
  location: Location;
  design: LocationDesignDocument;
  designId: string;
  activeDesignId: string;
}

export interface CastDesignSummary {
  id: string;
  castMemberId: string;
  title: string | null;
  interpretation: string | null;
  appearance: string[];
  costume: string[];
  voiceCasting: string | null;
  generationGuidance: string[];
}

export interface LocationDesignSummary {
  id: string;
  locationId: string;
  title: string | null;
  spatialThesis: string;
  architecture: string[];
  setDressing: string[];
  props: string[];
  environmentSheetGuidance: string[];
  generationGuidance: string[];
}

export interface DepartmentLookbookContext {
  lookbook: Lookbook;
  cardImage: LookbookImage | null;
  isActive: true;
}

export interface CastDesignContextReport extends DepartmentCommandReport {
  castMember: CastMember;
  screenplay: Pick<
    Screenplay,
    'title' | 'logline' | 'summary' | 'centralConflict' | 'dramaticQuestion'
  > | null;
  activeDesign: CastDesignDocument | null;
  activeDesignSummary: CastDesignSummary | null;
  scenes: Array<{
    sceneId: string;
    sequenceId: string;
    sequenceTitle?: string;
    title: string;
    setting: Scene['setting'];
    blocks: Block[];
  }>;
  activeLookbook: DepartmentLookbookContext | null;
  assets: Asset[];
  assetRoleCounts: Array<{ role: string; count: number }>;
  generationReadiness: {
    characterSheet: boolean;
    profile: boolean;
    notes: string[];
  };
}

export interface ProductionDesignLocationContextReport extends DepartmentCommandReport {
  location: Location;
  activeDesign: LocationDesignDocument | null;
  activeDesignSummary: LocationDesignSummary | null;
  scenes: Array<{
    sceneId: string;
    sequenceId: string;
    sequenceTitle?: string;
    title: string;
    setting: Scene['setting'];
    storyFunction: string[];
    excerpts: string[];
  }>;
  activeLookbook: DepartmentLookbookContext | null;
  assets: Asset[];
  assetRoleCounts: Array<{ role: string; count: number }>;
  generationReadiness: {
    environmentSheet: boolean;
    notes: string[];
  };
}
