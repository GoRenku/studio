import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type {
  VisualLanguageCatalogDifficulty,
  VisualLanguageCatalogIllustration,
} from '../../../client/index.js';

export interface CatalogReadContext {
  catalogRoot: string;
  issues: DiagnosticIssue[];
}

export interface ExplanationFrontmatter {
  id: string;
  category: string;
  name: string;
  summary: string;
  promptTemplate: string;
  illustration: VisualLanguageCatalogIllustration;
  tags: string[];
  appliesTo: string[];
  difficulty?: VisualLanguageCatalogDifficulty;
}
