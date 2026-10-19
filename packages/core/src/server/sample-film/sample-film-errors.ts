import { createDiagnosticWarning, isStructuredError, type DiagnosticIssue } from '@gorenku/studio-diagnostics';
import { UPDATE_RENKU_SUGGESTION } from '../database/lifecycle/project-database-compatibility.js';
import { ProjectDataError } from '../project-data-error.js';

const MEGABYTE = 1_000_000;

export function formatMegabytes(bytes: number): string {
  return `${Math.round(bytes / MEGABYTE)} MB`;
}

export function sampleFilmFolderInUseError(projectFolder: string): ProjectDataError {
  return new ProjectDataError(
    'SAMPLE_FILM_FOLDER_IN_USE',
    `The Project Library already has a folder that is not a Renku project: ${projectFolder}`,
    { suggestion: 'Move or rename that folder, then try again.' }
  );
}

export function sampleFilmInsufficientSpaceError(input: {
  storageRoot: string;
  neededBytes: number;
  availableBytes: number;
}): ProjectDataError {
  return new ProjectDataError(
    'SAMPLE_FILM_INSUFFICIENT_SPACE',
    `The sample film needs ${formatMegabytes(input.neededBytes)} of free space in ${input.storageRoot}; ${formatMegabytes(input.availableBytes)} is available.`,
    { suggestion: 'Free up disk space, then try again.' }
  );
}

export function sampleFilmDownloadFailedError(reason: string): ProjectDataError {
  return new ProjectDataError(
    'SAMPLE_FILM_DOWNLOAD_FAILED',
    `The sample film download stopped. ${reason}`,
    { suggestion: 'Check your internet connection, then try again.' }
  );
}

export function sampleFilmRequiresNewerRenkuError(version: string): ProjectDataError {
  return new ProjectDataError(
    'SAMPLE_FILM_REQUIRES_NEWER_RENKU',
    `This sample film (version ${version}) needs a newer version of Renku.`,
    { suggestion: `${UPDATE_RENKU_SUGGESTION} Then open the sample film again.` }
  );
}

export function sampleFilmUnpackFailedError(reason: string): ProjectDataError {
  return new ProjectDataError(
    'SAMPLE_FILM_UNPACK_FAILED',
    `The sample film could not be unpacked. ${reason}`,
    { suggestion: 'Try again. If it keeps failing, report it with this message.' }
  );
}

export function sampleFilmStorageFailedError(error: unknown, targetPath: string): ProjectDataError {
  return new ProjectDataError(
    'SAMPLE_FILM_STORAGE_FAILED',
    `Renku could not write the sample film to ${targetPath}: ${describeFileSystemError(error)}`,
    { suggestion: 'Check that the Project Library folder is writable, then try again.' }
  );
}

export function sampleFilmStagingCleanupWarning(error: unknown, stagingFolder: string): DiagnosticIssue {
  return createDiagnosticWarning(
    'SAMPLE_FILM_STORAGE_FAILED',
    `Renku could not remove the temporary download folder: ${describeFileSystemError(error)}`,
    { path: [], context: 'Sample film installation', filePath: stagingFolder },
    'Delete that folder when the sample film is no longer installing.'
  );
}

export function sampleFilmInstallationFailedError(error: unknown): ProjectDataError {
  return new ProjectDataError(
    'SAMPLE_FILM_INSTALLATION_FAILED',
    `The sample film installation failed: ${error instanceof Error ? error.message : String(error)}`,
    { suggestion: 'Try again.' }
  );
}

/** The structured code of an installation failure; unexpected errors report SAMPLE_FILM_INSTALLATION_FAILED. */
export function sampleFilmFailureCode(error: unknown): string {
  return isStructuredError(error) ? error.code : sampleFilmInstallationFailedError(error).code;
}

function describeFileSystemError(error: unknown): string {
  if (error instanceof Error && 'code' in error) {
    const syscall = 'syscall' in error && typeof error.syscall === 'string' ? ` during ${error.syscall}` : '';
    return `${String(error.code)}${syscall}`;
  }
  return error instanceof Error ? error.message : String(error);
}
