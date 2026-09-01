import type { Asset } from './assets.js';
import type { JsonValue } from './json.js';
import type { MediaGenerationProvenance } from './media-generation-review.js';
import type { ProjectRelativePath } from './project/index.js';

export interface CastVoice {
  id: string;
  castMemberId: string;
  name: string;
  purpose: string;
  isDefault: boolean;
  voiceIdentity: JsonValue | null;
  sample: Asset;
  createdAt: string;
  updatedAt: string;
}

export interface CastVoiceFileAttachmentDocument {
  kind: 'castVoiceFileAttachment';
  castMemberId: string;
  name: string;
  purpose: string;
  voiceIdentity?: JsonValue;
  sample: {
    sourceProjectRelativePath: ProjectRelativePath;
    title: string;
    generationProvenance?: MediaGenerationProvenance;
  };
}

export interface CastVoiceListReport {
  voices: CastVoice[];
}

export interface CastVoiceReadReport {
  voice: CastVoice;
}

export interface CastVoiceValidationReport {
  valid: true;
  warnings: unknown[];
}

export interface CastVoiceAttachmentReport {
  valid: true;
  warnings: unknown[];
  project: {
    id?: string;
    projectName: string;
  };
  castMember: {
    id: string;
    handle: string;
    name: string;
  };
  voice: CastVoice;
  changes: Array<{ type: 'castVoice.attached'; castMemberId: string; voiceId: string }>;
  resourceKeys: string[];
}

export interface CastVoiceDefaultSelectionReport {
  valid: true;
  warnings: unknown[];
  project: {
    id?: string;
    projectName: string;
  };
  castMemberId: string;
  selectedCastVoiceId: string;
  voices: CastVoice[];
  resourceKeys: string[];
}

export interface CastVoiceRemoveReport {
  project: {
    id?: string;
    projectName: string;
  };
  removed: {
    castMemberId: string;
    voiceId: string;
    sampleAssetId: string;
  };
  changes: Array<{ type: 'castVoice.removed'; castMemberId: string; voiceId: string }>;
  recovery?: import('./trash.js').RecoverableMutationReport['recovery'];
  resourceKeys: string[];
}
