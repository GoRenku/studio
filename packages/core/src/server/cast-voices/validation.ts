import fs from 'node:fs/promises';
import path from 'node:path';
import type { CastVoiceFileAttachmentDocument } from '../../client/cast-voices.js';
import type { MediaGenerationProvenance } from '../../client/media-generation-review.js';
import { validateMediaGenerationProvenance } from '../assets/generation-provenance.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import {
  normalizeProjectRelativePath,
  resolveProjectRelativePath,
} from '../files/project-relative-paths.js';
import { ProjectDataError } from '../project-data-error.js';
import { castVoiceNameExists } from '../database/access/cast-voices.js';
import { requireCastMember } from './projection.js';
import { validateVoiceIdentity } from './voice-identity.js';

const AUDIO_EXTENSIONS = new Map([
  ['.mp3', 'audio/mpeg'],
  ['.wav', 'audio/wav'],
  ['.m4a', 'audio/mp4'],
]);

export interface ValidatedCastVoiceAttachment {
  castMember: ReturnType<typeof requireCastMember>;
  name: string;
  purpose: string;
  voiceIdentity: ReturnType<typeof validateVoiceIdentity>;
  sampleTitle: string;
  sourceProjectRelativePath: ReturnType<typeof normalizeProjectRelativePath>;
  generationProvenance?: MediaGenerationProvenance;
  mimeType: string;
  sizeBytes: number;
}

export async function validateCastVoiceFileAttachment(input: {
  projectFolder: string;
  session: DatabaseSession;
  document: CastVoiceFileAttachmentDocument;
}): Promise<ValidatedCastVoiceAttachment> {
  const document = input.document;
  if (document.kind !== 'castVoiceFileAttachment') {
    throw new ProjectDataError(
      'PROJECT_DATA340',
      'Cast Voice attachment kind must be castVoiceFileAttachment.'
    );
  }
  const castMember = requireCastMember(input.session, document.castMemberId);
  const name = requiredReferenceName(document.name);
  if (castVoiceNameExists(input.session, { castMemberId: castMember.id, name })) {
    throw new ProjectDataError(
      'PROJECT_DATA341',
      `Cast Member ${castMember.id} already has a Cast Voice named ${name}.`
    );
  }
  const purpose = requiredTrimmed(document.purpose, 'purpose');
  if (!document.sample) {
    throw new ProjectDataError('PROJECT_DATA344', 'Cast Voice sample is required.');
  }
  const sampleTitle = requiredTrimmed(document.sample.title, 'sample.title');
  const generationProvenance = document.sample.generationProvenance
    ? validateMediaGenerationProvenance(document.sample.generationProvenance)
    : undefined;
  if (generationProvenance && generationProvenance.mediaKind !== 'audio') {
    throw new ProjectDataError(
      'CORE_MEDIA_GENERATION_PROVENANCE_INVALID',
      'Cast Voice sample provenance must describe audio.'
    );
  }
  const sourceProjectRelativePath = normalizeProjectRelativePath(
    document.sample.sourceProjectRelativePath
  );
  const sourcePath = resolveProjectRelativePath(input.projectFolder, sourceProjectRelativePath);
  assertResolvedPathInsideProject(input.projectFolder, sourcePath);
  const stats = await statExistingFile(sourcePath);
  return {
    castMember,
    name,
    purpose,
    voiceIdentity: validateVoiceIdentity(document.voiceIdentity),
    sampleTitle,
    sourceProjectRelativePath,
    ...(generationProvenance ? { generationProvenance } : {}),
    mimeType: mimeTypeForAudioPath(sourceProjectRelativePath),
    sizeBytes: stats.size,
  };
}

function requiredReferenceName(input: string): string {
  const value = requiredTrimmed(input, 'name');
  if (!/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(value)) {
    throw new ProjectDataError(
      'PROJECT_DATA345',
      `Cast Voice reference name must use lower-case letters, numbers, and single hyphen separators: ${value}.`
    );
  }
  return value;
}

function requiredTrimmed(input: string, fieldName: string): string {
  const value = input?.trim();
  if (!value) {
    throw new ProjectDataError('PROJECT_DATA346', `Cast Voice ${fieldName} cannot be empty.`);
  }
  return value;
}

function mimeTypeForAudioPath(projectRelativePath: string): string {
  const extension = path.extname(projectRelativePath).toLowerCase();
  const mimeType = AUDIO_EXTENSIONS.get(extension);
  if (!mimeType) {
    throw new ProjectDataError(
      'PROJECT_DATA347',
      `Cast Voice sample file must be mp3, wav, or m4a: ${projectRelativePath}.`
    );
  }
  return mimeType;
}

async function statExistingFile(absolutePath: string): Promise<{ size: number }> {
  try {
    const stats = await fs.stat(absolutePath);
    if (!stats.isFile()) {
      throw new Error('not a regular file');
    }
    return { size: stats.size };
  } catch {
    throw new ProjectDataError(
      'PROJECT_DATA349',
      `Cast Voice sample file does not exist: ${absolutePath}.`
    );
  }
}

function assertResolvedPathInsideProject(projectFolder: string, absolutePath: string): void {
  const relative = path.relative(projectFolder, absolutePath);
  if (relative.startsWith('..') || path.isAbsolute(relative)) {
    throw new ProjectDataError(
      'PROJECT_DATA351',
      `Cast Voice sample file must be inside the project folder: ${absolutePath}.`
    );
  }
}
