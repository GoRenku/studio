export interface VisualLanguage {
  id: string;
  categoryId: string;
  name: string;
  summary?: string;
  priority: VisualLanguagePriority;
}

export interface VisualLanguageCategory {
  id: string;
  name: string;
  description?: string;
  source: VisualLanguageCategorySource;
}

export type VisualLanguageCategorySource = 'system' | 'project';
export type VisualLanguagePriority = 'default' | 'situational' | 'rare';
