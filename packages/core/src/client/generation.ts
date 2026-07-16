import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { ProjectRelativePath } from './project.js';

export type JsonScalar = string | number | boolean | null;
export type JsonValue = JsonScalar | JsonValue[] | { [key: string]: JsonValue };

export type GenerationPurpose =
  | 'image.create'
  | 'image.edit'
  | 'lookbook.image'
  | 'lookbook.video-sheet'
  | 'lookbook.storyboard-sheet'
  | 'cast.character-sheet'
  | 'cast.profile'
  | 'cast.voice-sample'
  | 'scene.dialogue-audio'
  | 'location.sheet'
  | 'location.hero'
  | 'scene.storyboard-sheet'
  | 'shot.first-frame'
  | 'shot.last-frame'
  | 'shot.video-prompt'
  | 'shot.video-take';
export type GenerationOutputMediaKind = 'image' | 'audio' | 'video';

export type GenerationTarget =
  | { kind: 'project'; id: string }
  | { kind: 'asset'; id: string }
  | { kind: 'lookbook'; id: string }
  | { kind: 'castMember'; id: string }
  | { kind: 'location'; id: string }
  | { kind: 'scene'; id: string }
  | { kind: 'sceneDialogue'; id: string }
  | { kind: 'sceneShotVideoTake'; id: string };

export interface GenerationModelIdentity {
  provider?: string;
  model?: string;
}

export interface GenerationSpec {
  purpose: GenerationPurpose;
  target: GenerationTarget;
  model?: GenerationModelIdentity;
  values: Record<string, JsonValue>;
  references: GenerationReferenceSelection[];
  title?: string;
}

export interface GenerationReferenceSelection {
  id: string;
  placement:
    | {
        kind: 'slot';
        sectionId: string;
        slotId: string;
        subject?: { kind: string; id: string };
      }
    | { kind: 'additional' };
  providerField?: string;
  reference: GenerationReference;
}

export type GenerationReference =
  | { kind: 'asset-file'; assetId: string; assetFileId: string }
  | { kind: 'project-file'; projectRelativePath: ProjectRelativePath };

export interface GenerationReferenceSlotSelectionInput {
  placement: Extract<GenerationReferenceSelection['placement'], { kind: 'slot' }>;
  reference: GenerationReference | null;
  providerField?: string | null;
}

export interface GenerationReferenceGuide {
  sections: GenerationReferenceGuideSection[];
  notices: GenerationGuideNotice[];
}

export interface GenerationReferenceGuideSection {
  id: string;
  label: string;
  slots: GenerationReferenceGuideSlot[];
}

export interface GenerationReferenceGuideSlot {
  id: string;
  label: string;
  subject?: { kind: string; id: string };
  guidance?: string;
  eligibleCandidates: GenerationReferenceCatalogItem[];
}

export interface GenerationGuideNotice {
  code: string;
  message: string;
  suggestion?: string;
}

export type GenerationProductSettingKind = 'aspect-ratio' | 'quality';

export interface GenerationProductSetting {
  kind: GenerationProductSettingKind;
  value: JsonValue;
}

export interface GenerationPurposeSettings {
  fixed: GenerationProductSetting[];
  recommended: GenerationProductSetting[];
  recommendedModel?: GenerationModelIdentity;
}

export interface GenerationContext {
  purpose: GenerationPurpose;
  target: GenerationTarget;
  outputMediaKind: GenerationOutputMediaKind;
  /** Target-resolved facts may include opaque authored source text at `contextText`. */
  facts: Record<string, JsonValue>;
  settings: GenerationPurposeSettings;
  models: GenerationModelDescriptor[];
  referenceGuide: GenerationReferenceGuide;
}

export interface GenerationModelDescriptor {
  provider: string;
  model: string;
  label: string;
  mediaKind: GenerationOutputMediaKind;
  fields: GenerationModelFieldDescriptor[];
}

export interface GenerationModelFieldDescriptor {
  name: string;
  label: string;
  kind: string;
  semantic?:
    | { kind: 'authored-text'; role: 'prompt' | 'negative-prompt' }
    | {
        kind: 'setting';
        role:
          | 'aspect-ratio'
          | 'quality'
          | 'duration'
          | 'voice'
          | 'voice-settings'
          | 'output-format'
          | 'language';
      }
    | {
        kind: 'media';
        role:
          | 'source-image'
          | 'reference-image'
          | 'first-frame'
          | 'last-frame'
          | 'source-video'
          | 'audio';
      };
  productSettingKind?: GenerationProductSettingKind;
  productSettingValues?: Record<string, JsonScalar>;
  required: boolean;
  defaultValue?: JsonValue;
  allowedValues?: JsonScalar[];
  minimum?: number;
  maximum?: number;
  description?: string;
  media?: {
    acceptedKinds: GenerationOutputMediaKind[];
    cardinality: 'one' | 'many';
    minimum: number;
    maximum: number | null;
  };
}

export interface GenerationReferenceCatalogItem {
  reference: GenerationReference;
  label: string;
  mediaKind: GenerationOutputMediaKind;
  mimeType: string | null;
  sizeBytes: number | null;
  width: number | null;
  height: number | null;
  durationSeconds: number | null;
  owner: { kind: string; id: string } | null;
  role: string;
  provenance: {
    origin: string;
    generationRunId?: string;
  };
  projectRelativePath: ProjectRelativePath;
}

export interface GenerationReferenceCatalogPage {
  items: GenerationReferenceCatalogItem[];
  nextCursor: string | null;
}

export interface GenerationSpecRecord {
  id: string;
  spec: GenerationSpec;
  createdAt: string;
  updatedAt: string;
}

export interface GenerationPreviewReference extends GenerationReferenceSelection {
  resolved: GenerationReferenceCatalogItem | null;
}

export interface GenerationPreview {
  specId?: string;
  spec: GenerationSpec;
  referenceGuide: GenerationReferenceGuide;
  references: GenerationPreviewReference[];
  diagnostics: DiagnosticIssue[];
  providerPayload?: Record<string, JsonValue>;
  settings?: GenerationPurposeSettings;
  models?: GenerationModelDescriptor[];
}

export type GenerationValidationReport =
  | {
      valid: true;
      spec: GenerationSpec;
      diagnostics: DiagnosticIssue[];
    }
  | {
      valid: false;
      diagnostics: DiagnosticIssue[];
    };

export interface GenerationEstimate {
  provider: string;
  model: string;
  estimatedCostUsd: number;
  approvalToken: string;
  billableUnits: Record<string, JsonValue>;
}

export type GenerationEstimateReport =
  | { valid: true; estimate: GenerationEstimate; diagnostics: [] }
  | { valid: false; diagnostics: DiagnosticIssue[] };

export type GenerationCostEstimate = Omit<GenerationEstimate, 'approvalToken'>;

export type GenerationCostEstimateReport =
  | { valid: true; estimate: GenerationCostEstimate; diagnostics: [] }
  | { valid: false; diagnostics: DiagnosticIssue[] };

export interface GenerationRun {
  id: string;
  specId: string;
  specSnapshot: GenerationSpec;
  provider: string;
  model: string;
  providerPayload: Record<string, JsonValue>;
  estimate: GenerationEstimate;
  status: 'simulated' | 'awaiting-attachment' | 'completed' | 'failed';
  outputs: Array<{
    artifactId: string;
    mimeType?: string;
    projectRelativePath?: ProjectRelativePath;
    contentHash?: string;
  }>;
  receipt: JsonValue | null;
  diagnostics: DiagnosticIssue[];
  startedAt: string;
  completedAt: string | null;
}

export type GenerationRunReport =
  | { valid: true; run: GenerationRun; diagnostics: DiagnosticIssue[] }
  | { valid: false; diagnostics: DiagnosticIssue[] };

export interface ShotVideoTakeSummary {
  id: string;
  sceneId: string;
  sourceShotListId: string;
  title: string;
  shotIds: string[];
  isPicked: boolean;
  createdAt: string;
  updatedAt: string;
}
