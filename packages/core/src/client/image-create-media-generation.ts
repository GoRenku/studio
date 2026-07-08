import type { AgentMediaReport } from './agent-media.js';
import type { GenerationReferenceFileInput } from './media-generation-lifecycle.js';
import type { ProjectRelativePath } from './project.js';
import type { ProjectMediaGenerationTarget } from './media-generation-target.js';
import { IMAGE_CREATE_GENERATION_PURPOSE } from './media-generation-purpose.js';

export type ImageCreateMode = 'text-to-image' | 'reference-to-image';

export type ImageCreateModelChoice =
  | 'fal-ai/openai/gpt-image-2'
  | 'fal-ai/nano-banana-2'
  | 'fal-ai/xai/grok-imagine-image';

export type ImageCreateParameterValues = Record<string, unknown>;

export interface ImageCreateReferenceImage {
  assetId: string;
  assetFileId: string;
  role: string;
}

export interface ImageCreateGenerationSpec {
  purpose: typeof IMAGE_CREATE_GENERATION_PURPOSE;
  target: ProjectMediaGenerationTarget;
  mode: ImageCreateMode;
  modelChoice: ImageCreateModelChoice;
  prompt: string;
  referenceImages: ImageCreateReferenceImage[];
  referenceFiles?: GenerationReferenceFileInput[];
  parameterValues: ImageCreateParameterValues;
  title?: string;
}

export interface ImageCreateGenerationContext {
  purpose: typeof IMAGE_CREATE_GENERATION_PURPOSE;
  target: ProjectMediaGenerationTarget;
  project: {
    id: string;
    name: string;
    title: string;
    aspectRatio: string | null;
  };
  recommendedModelChoice: ImageCreateModelChoice;
  modelDefaults: {
    textToImage: ImageCreateParameterValues;
    referenceToImage: ImageCreateParameterValues;
  };
  agentMedia: AgentMediaReport;
}

export interface ImageCreateModelChoiceReport {
  modelChoice: ImageCreateModelChoice;
  label: string;
  available: boolean;
  provider: 'fal-ai';
  textToImageModel: 'openai/gpt-image-2' | 'nano-banana-2' | 'xai/grok-imagine-image';
  referenceToImageModel:
    | 'openai/gpt-image-2/edit'
    | 'nano-banana-2/edit'
    | 'xai/grok-imagine-image/edit';
  mediaKind: 'image';
  modes: ImageCreateMode[];
  referenceImageCount: {
    min: number;
    max: number | null;
  };
  defaultParameterValues: {
    textToImage: ImageCreateParameterValues;
    referenceToImage: ImageCreateParameterValues;
  };
  parameterRows: {
    textToImage: ImageCreateParameterRow[];
    referenceToImage: ImageCreateParameterRow[];
  };
}

export interface ImageCreateParameterRow {
  key: string;
  label: string;
  required: boolean;
  defaultValue?: unknown;
  allowedValues?: unknown[];
  minimum?: number;
  maximum?: number;
}

export interface ImageCreateModelListReport {
  purpose: typeof IMAGE_CREATE_GENERATION_PURPOSE;
  target: ProjectMediaGenerationTarget;
  models: ImageCreateModelChoiceReport[];
}

export interface ImageCreateGenerationAssetFileReference {
  assetId: string;
  assetFileId: string;
  role: string;
  projectRelativePath: ProjectRelativePath;
  absolutePath: string;
  mediaKind: 'image';
  mimeType: string | null;
}
