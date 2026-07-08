import type { AgentMediaReport } from './agent-media.js';
import type { Asset, AssetFile } from './assets.js';
import type { ProjectRelativePath } from './project.js';
import type { AssetMediaGenerationTarget } from './media-generation-target.js';
import { IMAGE_EDIT_GENERATION_PURPOSE } from './media-generation-purpose.js';

export type ImageEditModelChoice =
  | 'fal-ai/openai/gpt-image-2/edit'
  | 'fal-ai/nano-banana-2/edit'
  | 'fal-ai/xai/grok-imagine-image/edit';

export type ImageEditParameterValues = Record<string, unknown>;

export interface ImageEditGenerationSpec {
  purpose: typeof IMAGE_EDIT_GENERATION_PURPOSE;
  target: AssetMediaGenerationTarget;
  sourceAssetFileId?: string;
  modelChoice: ImageEditModelChoice;
  prompt: string;
  parameterValues: ImageEditParameterValues;
  title?: string;
}

export interface ImageEditGenerationContext {
  purpose: typeof IMAGE_EDIT_GENERATION_PURPOSE;
  target: AssetMediaGenerationTarget;
  sourceAsset: Asset;
  sourceImageFiles: AssetFile[];
  selectedSourceAssetFileId: string | null;
  recommendedModelChoice: ImageEditModelChoice;
  sourceGeneration?: {
    runId: string;
    provider: string;
    model: string;
    mappedEditModelChoice?: ImageEditModelChoice;
  };
  agentMedia: AgentMediaReport;
}

export interface ImageEditModelChoiceReport {
  modelChoice: ImageEditModelChoice;
  label: string;
  available: boolean;
  provider: 'fal-ai';
  model: 'openai/gpt-image-2/edit' | 'nano-banana-2/edit' | 'xai/grok-imagine-image/edit';
  mediaKind: 'image';
  mode: 'image-edit';
  supportsSeed: boolean;
  sourceImageCount: {
    min: 1;
    max: 1;
    required: true;
  };
  defaultParameterValues: ImageEditParameterValues;
  parameterRows: ImageEditParameterRow[];
}

export interface ImageEditParameterRow {
  key: string;
  label: string;
  required: boolean;
  defaultValue?: unknown;
  allowedValues?: unknown[];
  minimum?: number;
  maximum?: number;
}

export interface ImageEditModelListReport {
  purpose: typeof IMAGE_EDIT_GENERATION_PURPOSE;
  target: AssetMediaGenerationTarget;
  models: ImageEditModelChoiceReport[];
}

export interface ImageEditGenerationAssetFileReference {
  assetId: string;
  assetFileId: string;
  role: string;
  projectRelativePath: ProjectRelativePath;
  absolutePath: string;
  mediaKind: 'image';
  mimeType: string | null;
}
