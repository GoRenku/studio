import type { Asset } from './assets.js';
import type { ProjectRelativePath } from './project.js';

export interface CastVoice {
  id: string;
  castMemberId: string;
  name: string;
  provider: string;
  model: string;
  voiceId: string;
  purpose: string;
  sample: Asset;
  createdAt: string;
  updatedAt: string;
}

export interface CastVoiceAttachmentDocument {
  kind: 'castVoiceAttachment';
  castMemberId: string;
  name: string;
  provider: string;
  model: string;
  voiceId: string;
  purpose: string;
  sample: {
    sourceProjectRelativePath: ProjectRelativePath;
    title: string;
    receipt?: unknown;
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
    name: string;
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

export interface CastVoiceRemoveReport {
  project: {
    id?: string;
    name: string;
  };
  removed: {
    castMemberId: string;
    voiceId: string;
    sampleAssetId: string;
  };
  changes: Array<{ type: 'castVoice.removed'; castMemberId: string; voiceId: string }>;
  resourceKeys: string[];
}
