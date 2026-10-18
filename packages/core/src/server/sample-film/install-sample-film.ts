import { randomBytes } from 'node:crypto';
import fs from 'node:fs/promises';
import path from 'node:path';
import type { DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type {
  SampleFilm,
  SampleFilmInstallation,
  SampleFilmInstallationReport,
} from '../../client/index.js';
import { resolveRenkuStorageRoot, type RenkuConfigPathOptions } from '../config/index.js';
import { projectDatabaseRequiresNewerRuntime } from '../database/lifecycle/project-database-compatibility.js';
import { openProjectStore } from '../database/lifecycle/store.js';
import { resolveProjectDatabasePath, resolveProjectFolder } from '../files/project-paths.js';
import { pathExists } from '../files/path-existence.js';
import { readProjectFromSession } from '../resources/full-project.js';
import { ARCHIVE_STALL_TIMEOUT_MS, downloadArchive } from './archive-download.js';
import { systemTarExecutable, unpackArchive } from './archive-unpack.js';
import {
  sampleFilmFolderInUseError,
  sampleFilmInsufficientSpaceError,
  sampleFilmRequiresNewerRenkuError,
  sampleFilmStagingCleanupWarning,
  sampleFilmStorageFailedError,
} from './sample-film-errors.js';
import { SAMPLE_FILM_PROJECT_NAME, resolveSampleFilmRelease, type SampleFilmRelease } from './sample-film-release.js';

export interface SampleFilmInstallationOptions {
  release?: SampleFilmRelease;
  fetcher?: typeof fetch;
  statfs?: (targetPath: string) => Promise<{ bavail: number | bigint; bsize: number | bigint }>;
  tarExecutable?: string;
  stallTimeoutMs?: number;
}

export type SampleFilmInstallationInput = RenkuConfigPathOptions & {
  onProgress?: (sampleFilm: SampleFilm) => void;
};

/** The outcome of the checks that run before anything is downloaded. */
export type SampleFilmPreparation = {
  storageRoot: string;
  projectFolder: string;
} & ({ target: 'project' } | { target: 'absent'; release: SampleFilmRelease });

const STAGING_PREFIX = '.sample-project-download-';
const STAGING_SUFFIX_ALPHABET = 'abcdefghijklmnopqrstuvwxyz0123456789';
const STAGING_ATTEMPTS = 5;

export function installSampleFilm(input: SampleFilmInstallationInput): Promise<SampleFilmInstallationReport> {
  return installSampleFilmWithOptions(input, {});
}

export async function installSampleFilmWithOptions(
  input: SampleFilmInstallationInput,
  options: SampleFilmInstallationOptions
): Promise<SampleFilmInstallationReport> {
  const preparation = await prepareSampleFilmInstallation(input, options);
  if (preparation.target === 'project') {
    return openPlacedSampleFilm(preparation, 'alreadyInLibrary', []);
  }
  const onProgress = input.onProgress;
  return await completeSampleFilmInstallation(preparation, options, (installation) => {
    onProgress?.({ archiveBytes: preparation.release.archiveBytes, inLibrary: false, installation });
  });
}

/** Checks the local target, then resolves the latest release and checks space. */
export async function prepareSampleFilmInstallation(
  input: RenkuConfigPathOptions,
  options: SampleFilmInstallationOptions
): Promise<SampleFilmPreparation> {
  const storageRoot = await resolveRenkuStorageRoot(input);
  await fs.mkdir(storageRoot, { recursive: true }).catch((error: unknown) => {
    throw sampleFilmStorageFailedError(error, storageRoot);
  });
  const projectFolder = resolveProjectFolder(storageRoot, SAMPLE_FILM_PROJECT_NAME);
  if (await classifySampleFilmTarget(projectFolder) === 'project') {
    return { storageRoot, projectFolder, target: 'project' };
  }
  const release = options.release ?? await resolveSampleFilmRelease(options.fetcher ?? fetch);
  if (release.archiveBytes !== null) {
    await assertFreeSpace(storageRoot, release.archiveBytes * 2, options);
  }
  return { release, storageRoot, projectFolder, target: 'absent' };
}

/** True when the sample folder holds a Project database; anything else is not the sample. */
export async function isSampleFilmInLibrary(
  input: RenkuConfigPathOptions
): Promise<boolean> {
  const storageRoot = await resolveRenkuStorageRoot(input);
  const projectFolder = resolveProjectFolder(storageRoot, SAMPLE_FILM_PROJECT_NAME);
  try {
    if (!(await fs.stat(projectFolder)).isDirectory()) {
      return false;
    }
    return await pathExists(resolveProjectDatabasePath(projectFolder));
  } catch (error) {
    if (error instanceof Error && 'code' in error && (error.code === 'ENOENT' || error.code === 'ENOTDIR')) {
      return false;
    }
    throw error;
  }
}

/** Downloads, unpacks, places and opens the sample. Always removes staging. */
export async function completeSampleFilmInstallation(
  preparation: Extract<SampleFilmPreparation, { target: 'absent' }>,
  options: SampleFilmInstallationOptions,
  onProgress: (installation: SampleFilmInstallation) => void
): Promise<SampleFilmInstallationReport> {
  const { release } = preparation;
  const stagingFolder = await createStagingFolder(preparation.storageRoot);
  let outcome: SampleFilmInstallationReport['outcome'];
  try {
    const archivePath = path.join(stagingFolder, 'archive.tar.gz');
    onProgress({ state: 'downloading', receivedBytes: 0 });
    await downloadArchive({
      url: release.archiveUrl,
      expectedBytes: release.archiveBytes,
      destination: archivePath,
      fetcher: options.fetcher ?? fetch,
      stallTimeoutMs: options.stallTimeoutMs ?? ARCHIVE_STALL_TIMEOUT_MS,
      onBytes: (receivedBytes) => onProgress({ state: 'downloading', receivedBytes }),
    });
    onProgress({ state: 'preparing' });
    const stagedProject = await unpackArchive({
      tarExecutable: options.tarExecutable ?? systemTarExecutable(),
      archivePath,
      destination: stagingFolder,
      projectName: SAMPLE_FILM_PROJECT_NAME,
    });
    // A sample made by a newer Renku cannot open here; keep it out of the Library.
    if (projectDatabaseRequiresNewerRuntime({ projectFolder: stagedProject })) {
      throw sampleFilmRequiresNewerRenkuError(release.version);
    }
    outcome = await placeStagedProject(stagedProject, preparation.projectFolder);
  } catch (error) {
    await fs.rm(stagingFolder, { recursive: true, force: true }).catch(() => {});
    throw error;
  }

  const warnings: DiagnosticIssue[] = [];
  await fs.rm(stagingFolder, { recursive: true, force: true }).catch((error: unknown) => {
    warnings.push(sampleFilmStagingCleanupWarning(error, stagingFolder));
  });
  return openPlacedSampleFilm(preparation, outcome, warnings);
}

/**
 * The never-overwrite rule: a folder with a Project database is the sample
 * already in the Library; anything else at that path stops the installation.
 */
async function classifySampleFilmTarget(projectFolder: string): Promise<'project' | 'absent'> {
  if (!(await pathExists(projectFolder))) {
    return 'absent';
  }
  const isFolder = (await fs.stat(projectFolder)).isDirectory();
  if (isFolder && (await pathExists(resolveProjectDatabasePath(projectFolder)))) {
    return 'project';
  }
  throw sampleFilmFolderInUseError(projectFolder);
}

async function assertFreeSpace(
  storageRoot: string,
  neededBytes: number,
  options: SampleFilmInstallationOptions
): Promise<void> {
  const stats = await (options.statfs ?? fs.statfs)(storageRoot);
  const availableBytes = Number(stats.bavail) * Number(stats.bsize);
  if (availableBytes < neededBytes) {
    throw sampleFilmInsufficientSpaceError({ storageRoot, neededBytes, availableBytes });
  }
}

async function createStagingFolder(storageRoot: string): Promise<string> {
  for (let attempt = 1; ; attempt++) {
    const stagingFolder = path.join(storageRoot, `${STAGING_PREFIX}${randomSuffix()}`);
    try {
      await fs.mkdir(stagingFolder);
      return stagingFolder;
    } catch (error) {
      const exists = error instanceof Error && 'code' in error && error.code === 'EEXIST';
      if (!exists || attempt === STAGING_ATTEMPTS) {
        throw sampleFilmStorageFailedError(error, stagingFolder);
      }
    }
  }
}

function randomSuffix(): string {
  return Array.from(randomBytes(6), (byte) => STAGING_SUFFIX_ALPHABET[byte % STAGING_SUFFIX_ALPHABET.length]).join('');
}

async function placeStagedProject(
  stagedProject: string,
  projectFolder: string
): Promise<SampleFilmInstallationReport['outcome']> {
  // The target may have appeared while the download ran.
  if ((await classifySampleFilmTarget(projectFolder)) === 'project') {
    return 'alreadyInLibrary';
  }
  try {
    await fs.rename(stagedProject, projectFolder);
    return 'installed';
  } catch (error) {
    const occupied = error instanceof Error && 'code' in error &&
      (error.code === 'EEXIST' || error.code === 'ENOTEMPTY');
    if (occupied && (await classifySampleFilmTarget(projectFolder)) === 'project') {
      return 'alreadyInLibrary';
    }
    throw sampleFilmStorageFailedError(error, projectFolder);
  }
}

/** Opening upgrades an older database through the existing store, after a verified backup. */
function openPlacedSampleFilm(
  preparation: SampleFilmPreparation,
  outcome: SampleFilmInstallationReport['outcome'],
  warnings: DiagnosticIssue[]
): SampleFilmInstallationReport {
  const session = openProjectStore({ projectFolder: preparation.projectFolder, create: false });
  try {
    const project = readProjectFromSession({ session, projectFolder: preparation.projectFolder });
    return {
      outcome,
      projectName: SAMPLE_FILM_PROJECT_NAME,
      projectPath: preparation.projectFolder,
      title: project.title,
      version: outcome === 'installed' && preparation.target === 'absent' ? preparation.release.version : null,
      warnings,
    };
  } finally {
    session.close();
  }
}
