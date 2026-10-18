import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type { ProjectDataError } from './diagnostics.js';

export interface SampleFilm {
  /** Download size reported by GitHub; null before lookup or when unavailable. */
  archiveBytes: number | null;
  /** True when the Project Library already holds the sample project. */
  inLibrary: boolean;
  /** The current attempt in this Studio server process. */
  installation: SampleFilmInstallation;
}

export type SampleFilmInstallation =
  | { state: 'idle' }
  | { state: 'downloading'; receivedBytes: number }
  | { state: 'preparing' }
  | { state: 'ready'; projectName: string }
  | { state: 'failed'; error: ProjectDataError };

export interface SampleFilmInstallationReport {
  outcome: 'installed' | 'alreadyInLibrary';
  /** Stored Project name; equals the folder name in the Project Library. */
  projectName: string;
  projectPath: string;
  title: string;
  /** Downloaded release version; null when opening an existing local sample. */
  version: string | null;
  warnings: DiagnosticIssue[];
}
