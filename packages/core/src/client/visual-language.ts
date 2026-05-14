import type { RichTextAssetLink } from './assets.js';

export interface VisualLanguage {
  id: string;
  categoryId: string;
  name: string;
  summary?: string;
  priority: VisualLanguagePriority;
  guidance?: string;
  prompt?: string;
  guidanceAsset?: RichTextAssetLink;
  promptAsset?: RichTextAssetLink;
}

export interface VisualLanguageCategory {
  id: string;
  name: string;
  description?: string;
  source: VisualLanguageCategorySource;
}

export type VisualLanguageCategorySource = 'system' | 'project';
export type VisualLanguagePriority = 'default' | 'situational' | 'rare';
