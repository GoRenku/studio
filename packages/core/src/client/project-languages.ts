export interface ProjectLanguage {
  id: string;
  localeTag: string;
  displayName?: string;
  isBase: boolean;
  supportsAudio: boolean;
  supportsSubtitles: boolean;
}

export const DEFAULT_PROJECT_LOCALE_TAG = 'en-US' as const;

export const SUPPORTED_PROJECT_LOCALES = [
  { localeTag: 'en-US', displayName: 'English' },
  { localeTag: 'es-ES', displayName: 'Spanish' },
  { localeTag: 'de-DE', displayName: 'German' },
  { localeTag: 'fr-FR', displayName: 'French' },
  { localeTag: 'zh-CN', displayName: 'Chinese' },
  { localeTag: 'ja-JP', displayName: 'Japanese' },
  { localeTag: 'tr-TR', displayName: 'Turkish' },
] as const;
