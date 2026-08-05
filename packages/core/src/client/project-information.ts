export interface ProjectInformationPatch {
  title?: string;
  aspectRatio?: string | null;
  logline?: string | null;
  synopsis?: string | null;
  premise?: string | null;
  intendedAudience?: string | null;
  format?: string | null;
  targetRuntimeMinutes?: number | null;
  primaryGenre?: string | null;
  secondaryGenres?: string[] | null;
  tones?: string[] | null;
  contentRatingIntent?: string | null;
  creativeBoundaries?: string[] | null;
  centralConflict?: string | null;
  dramaticQuestion?: string | null;
  themes?: string[] | null;
  historicalBasis?: string[] | null;
  dramatizedElements?: string[] | null;
  screenplayDraftStatus?: string | null;
  researchSources?: string[] | null;
  assumptions?: string[] | null;
  openQuestions?: string[] | null;
  nextSteps?: string[] | null;
  languages?: ProjectLanguagePatchOperation[];
}

export type ProjectLanguagePatchOperation =
  | {
      operation: 'add';
      localeTag: string;
      displayName?: string;
      isBase?: boolean;
      supportsAudio?: boolean;
      supportsSubtitles?: boolean;
    }
  | {
      operation: 'update';
      localeTag: string;
      displayName?: string | null;
      isBase?: boolean;
      supportsAudio?: boolean;
      supportsSubtitles?: boolean;
    }
  | { operation: 'remove'; localeTag: string }
  | { operation: 'setBase'; localeTag: string };
