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
  sampleSource: CastVoiceSampleSource;
  sample: Asset;
  createdAt: string;
  updatedAt: string;
}

export type CastVoiceSampleSource =
  | {
      kind: 'custom_file';
    }
  | {
      kind: 'generated_sample';
    }
  | {
      kind: 'elevenlabs_voice_sample';
      sampleId: string;
      fetchedAt: string;
      apiBaseUrl: string;
    };

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

export interface CastVoiceElevenLabsSampleAttachmentDocument {
  kind: 'castVoiceElevenLabsSampleAttachment';
  castMemberId: string;
  name: string;
  provider: 'elevenlabs';
  model: 'eleven_v3' | 'eleven_multilingual_v2' | 'eleven_turbo_v2_5';
  voiceId: string;
  purpose: string;
  sample: {
    title: string;
  };
}

export type CastVoiceAttachmentCommandDocument =
  | CastVoiceAttachmentDocument
  | CastVoiceElevenLabsSampleAttachmentDocument;

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
  sampleRetrieval?: {
    provider: 'elevenlabs';
    voiceId: string;
    sampleId: string;
    mimeType: 'audio/mpeg';
    sizeBytes: number;
    fetchedAt: string;
    apiBaseUrl: string;
  };
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
