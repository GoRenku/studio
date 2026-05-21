export type CastDesignTabId =
  | 'description'
  | 'character-sheet'
  | 'voice-design';

export type CastDesignAssetKind = 'image' | 'sheet' | 'voice' | 'text';

export type CastDesignAssetAspect =
  | 'portrait'
  | 'square'
  | 'sheet'
  | 'wide'
  | 'ratio-4-3'
  | 'ratio-9-16'
  | 'voice'
  | 'text';

export interface CastDesignAsset {
  id: string;
  assetId?: string;
  role?: string;
  title: string;
  model: string;
  kind: CastDesignAssetKind;
  aspect: CastDesignAssetAspect;
  imageUrl?: string;
  text?: string;
  selected?: boolean;
}

export interface CastDescriptionContent {
  descriptionText: string;
  descriptionImages: CastDesignAsset[];
}

export interface CastAssetCollection {
  selectedAssets: CastDesignAsset[];
  takes: CastDesignAsset[];
  emptySelected: string;
  emptyTakes: string;
}

export type CharacterSheetProviderId = 'fal-ai' | 'replicate';

export type CharacterSheetModelId =
  | 'nano-banana-2'
  | 'nano-banana-pro'
  | 'gpt-image-2'
  | 'grok-imagine-image';

export type CharacterSheetStyleId =
  | 'all-in-one'
  | 'turnaround-model'
  | 'expression'
  | 'pose-gesture'
  | 'costume-outfit';

export type CharacterSheetSize = '1K' | '2K' | '4K';

export type CharacterSheetOutputFormat = 'PNG' | 'JPEG' | 'WEBP';

export type CharacterSheetQuality = 'Medium' | 'Low' | 'High';

export type CharacterSheetThinkingLevel = 'minimal' | 'high';

export interface CharacterSheetGenerationOptions {
  provider: CharacterSheetProviderId;
  model: CharacterSheetModelId;
  sheetStyle: CharacterSheetStyleId;
  size: CharacterSheetSize;
  outputFormat: CharacterSheetOutputFormat;
  quality: CharacterSheetQuality;
  seed: string;
  safetyTolerance: number;
  webSearchEnabled: boolean;
  thinkingLevel: CharacterSheetThinkingLevel;
  takeCount: number;
  characterDescription: string;
}

export interface CharacterSheetStyleOption {
  id: CharacterSheetStyleId;
  label: string;
  lightImageUrl: string;
  darkImageUrl: string;
}

export interface ReferenceImage {
  id: string;
  imageUrl: string;
  label: string;
  localObjectUrl: boolean;
}
