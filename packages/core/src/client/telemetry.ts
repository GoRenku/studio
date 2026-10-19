/** Closed answers to "Where did you hear about Renku?"; no free text is ever sent. */
export const HEARD_ABOUT_RENKU_ANSWERS = [
  'github',
  'hn',
  'reddit',
  'youtube',
  'x',
  'linkedin',
  'search',
  'ai-assistant',
  'friend-or-colleague',
  'latentmatinee',
  'other',
] as const;

export type HeardAboutRenkuAnswer = (typeof HEARD_ABOUT_RENKU_ANSWERS)[number];

export const HEARD_ABOUT_RENKU_ANSWER_LABELS: Record<HeardAboutRenkuAnswer, string> = {
  github: 'GitHub',
  hn: 'Hacker News',
  reddit: 'Reddit',
  youtube: 'YouTube',
  x: 'X (Twitter)',
  linkedin: 'LinkedIn',
  search: 'A search engine',
  'ai-assistant': 'An AI assistant',
  'friend-or-colleague': 'A friend or colleague',
  latentmatinee: 'Latent Matinee',
  other: 'Other',
};

/** The environment switch that stops every send, in the order Renku checks them. */
export type TelemetryBlock = 'DO_NOT_TRACK' | 'RENKU_TELEMETRY_DISABLED' | 'CI';

export interface TelemetryStatus {
  /** True while `telemetry.json` exists in the Renku config folder. */
  enabled: boolean;
  /** The random install ID; present only while enabled. */
  installId: string | null;
  blockedBy: TelemetryBlock | null;
  /** True when RENKU_TELEMETRY_DEBUG prints events instead of sending them. */
  debug: boolean;
}

export interface TelemetryChoice {
  enabled: boolean;
  /** Accepted only together with `enabled: true`. */
  heardAbout?: HeardAboutRenkuAnswer;
}

export type TelemetryEvent =
  | { name: 'studio_started' }
  | { name: 'project_created' }
  | { name: 'fdx_imported' }
  | { name: 'sample_film_download_started' }
  | { name: 'sample_film_download_finished'; result: 'installed' }
  | { name: 'sample_film_download_finished'; result: 'failed'; errorCode: string }
  | { name: 'sample_film_opened' }
  | { name: 'generation_completed'; mediaKind: 'image' | 'video' | 'audio' }
  | { name: 'heard_about'; answer: HeardAboutRenkuAnswer }
  | { name: 'telemetry_opted_out' };

export const TELEMETRY_FIELD_LIST_URL = 'https://gorenku.com/privacy#app-usage-statistics';
