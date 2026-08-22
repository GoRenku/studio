import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';

export interface VisualLanguageCatalog {
  entries: VisualLanguageCatalogEntry[];
  warnings: DiagnosticIssue[];
}

export interface VisualLanguageCatalogEntry {
  id: string;
  category: string;
  name: string;
  summary: string;
  explanationMarkdown: string;
  promptTemplateMarkdown: string;
  illustration: VisualLanguageCatalogIllustration;
  tags: string[];
  appliesTo: string[];
  difficulty?: VisualLanguageCatalogDifficulty;
}

export interface VisualLanguageCatalogIllustration {
  catalogRelativePath: string;
  mediaKind: 'image' | 'video';
}

export type VisualLanguageCatalogDifficulty =
  | 'beginner'
  | 'intermediate'
  | 'advanced';

export interface ReadVisualLanguageCatalogEntryInput {
  id: string;
}
