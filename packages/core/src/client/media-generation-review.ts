import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { ProjectRelativePath } from './project/index.js';

export type JsonValue =
  | null
  | boolean
  | number
  | string
  | JsonValue[]
  | { [key: string]: JsonValue };

export type MediaGenerationKind = 'image' | 'video' | 'audio';

export interface MediaGenerationReviewDocument {
  provider: string;
  model: string;
  mediaKind: MediaGenerationKind;
  prompt: string | null;
  request: JsonValue;
}

export interface MediaGenerationProvenance extends MediaGenerationReviewDocument {
  receipt?: JsonValue;
}

export interface MediaGenerationReferenceView {
  kind: MediaGenerationKind;
  projectRelativePath: ProjectRelativePath;
  browserUrl?: string;
  available: boolean;
}

export interface MediaGenerationPreviewResource {
  kind: 'mediaGenerationPreview';
  documentPath?: ProjectRelativePath;
  provider: string;
  model: string;
  mediaKind: MediaGenerationKind;
  prompt: string | null;
  references: MediaGenerationReferenceView[];
  configuration: JsonValue;
  editable: boolean;
  diagnostics: DiagnosticIssue[];
}
