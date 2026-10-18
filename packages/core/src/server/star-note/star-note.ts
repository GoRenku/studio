import fs from 'node:fs/promises';
import path from 'node:path';
import { randomUUID } from 'node:crypto';
import { StructuredError } from '@gorenku/studio-diagnostics';
import type { StarNoteOffer } from '../../client/index.js';
import {
  resolveRenkuStateDir,
  resolveRenkuStorageRoot,
  type RenkuConfigPathOptions,
} from '../config/index.js';
import { openProjectStore } from '../database/lifecycle/store.js';
import { resolveProjectFolder } from '../files/project-paths.js';
import { validateProjectName } from '../commands/project-name-validation.js';
import { SAMPLE_FILM_PROJECT_NAME } from '../sample-film/sample-film-release.js';
import { hasGenerationActivity } from './generation-activity.js';

export const STAR_NOTE_FILE_NAME = 'star-note.json' as const;

interface StarNoteState {
  version: 1;
  shownAt: string;
}

export function resolveStarNotePath(options: RenkuConfigPathOptions = {}): string {
  return path.join(resolveRenkuStateDir(options), STAR_NOTE_FILE_NAME);
}

/**
 * Shows the star note once per user, for the first of the user's own
 * projects with generation activity. Records it before answering.
 */
export async function offerStarNote(
  input: RenkuConfigPathOptions & { projectName: string }
): Promise<StarNoteOffer> {
  if (input.projectName === SAMPLE_FILM_PROJECT_NAME) {
    return { show: false };
  }
  validateProjectName(input.projectName);
  const statePath = resolveStarNotePath(input);
  if (await readStarNoteState(statePath)) {
    return { show: false };
  }
  if (!(await projectHasGenerationActivity(input))) {
    return { show: false };
  }
  await writeStarNoteState(statePath, { version: 1, shownAt: new Date().toISOString() });
  return { show: true };
}

async function projectHasGenerationActivity(
  input: RenkuConfigPathOptions & { projectName: string }
): Promise<boolean> {
  const storageRoot = await resolveRenkuStorageRoot(input);
  const session = openProjectStore({
    projectFolder: resolveProjectFolder(storageRoot, input.projectName),
    create: false,
  });
  try {
    return hasGenerationActivity(session);
  } finally {
    session.close();
  }
}

async function readStarNoteState(statePath: string): Promise<StarNoteState | null> {
  let contents: string;
  try {
    contents = await fs.readFile(statePath, 'utf8');
  } catch (error) {
    if (error instanceof Error && 'code' in error && error.code === 'ENOENT') {
      return null;
    }
    throw starNoteStateInvalidError(statePath, error instanceof Error ? error.message : String(error));
  }
  let state: unknown;
  try {
    state = JSON.parse(contents);
  } catch {
    throw starNoteStateInvalidError(statePath, 'It is not valid JSON.');
  }
  if (!isStarNoteState(state)) {
    throw starNoteStateInvalidError(statePath, 'It does not match the expected shape.');
  }
  return state;
}

function isStarNoteState(value: unknown): value is StarNoteState {
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return false;
  }
  const state = value as Record<string, unknown>;
  return state.version === 1 && typeof state.shownAt === 'string' &&
    !Number.isNaN(Date.parse(state.shownAt));
}

async function writeStarNoteState(statePath: string, state: StarNoteState): Promise<void> {
  const temporaryPath = `${statePath}.${randomUUID()}.tmp`;
  try {
    await fs.mkdir(path.dirname(statePath), { recursive: true });
    await fs.writeFile(temporaryPath, `${JSON.stringify(state, null, 2)}\n`, { flag: 'wx' });
    await fs.rename(temporaryPath, statePath);
  } catch (error) {
    throw new StructuredError({
      code: 'STAR_NOTE_STATE_WRITE_FAILED',
      message: `Cannot write ${statePath}: ${error instanceof Error ? error.message : String(error)}`,
      suggestion: 'Check that the Renku state directory is writable.',
    });
  } finally {
    await fs.rm(temporaryPath, { force: true }).catch(() => {});
  }
}

function starNoteStateInvalidError(statePath: string, reason: string): StructuredError {
  return new StructuredError({
    code: 'STAR_NOTE_STATE_INVALID',
    message: `Cannot read ${statePath}. ${reason}`,
    suggestion: 'Delete that file to reset it; the note may then show once more.',
  });
}
