import type { RichTextAssetLink } from './assets.js';

export interface ContinuityReference {
  id: string;
  kind: string;
  name: string;
  summary?: string;
  description?: string;
  descriptionAsset?: RichTextAssetLink;
}
