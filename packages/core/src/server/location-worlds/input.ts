import fs from 'node:fs/promises';
import path from 'node:path';
import { createDiagnosticError, type DiagnosticIssue } from '@gorenku/studio-diagnostics';
import type {
  Location,
  LocationWorldGenerationDocument,
  ProjectRelativePath,
} from '../../client/index.js';
import type { DatabaseSession } from '../database/lifecycle/store.js';
import { readLocationRecord } from '../database/access/locations.js';
import { normalizeProjectRelativePath, resolveProjectRelativePath } from '../files/project-relative-paths.js';
import { assertResolvedPathInsideProject } from '../project-asset-files/path-guards.js';
import { ProjectDataError } from '../project-data-error.js';

const IMAGE_EXTENSIONS = new Set(['jpg', 'jpeg', 'png', 'webp']);

interface ValidatedLocationWorldImage {
  projectRelativePath: ProjectRelativePath;
  absolutePath: string;
  fileName: string;
  extension: 'jpg' | 'jpeg' | 'png' | 'webp';
  mimeType: string;
}

type ValidatedLocationWorldSource =
  | { kind: 'panorama'; image: ValidatedLocationWorldImage }
  | { kind: 'multiImage'; images: ValidatedLocationWorldImage[] };

interface RawSourceImage {
  projectRelativePath: string;
  path: string[];
}

type RawLocationWorldSource =
  | { kind: 'panorama'; images: [RawSourceImage] }
  | { kind: 'multiImage'; images: RawSourceImage[] };

export interface ValidatedLocationWorldInput {
  document: LocationWorldGenerationDocument;
  location: Location;
  source: ValidatedLocationWorldSource;
}

export async function validateLocationWorldInput(input: {
  document: unknown;
  session: DatabaseSession;
  projectFolder: string;
}): Promise<ValidatedLocationWorldInput> {
  const issues: DiagnosticIssue[] = [];
  if (!isRecord(input.document)) {
    throw invalidInput([issue('Location World generation input must be an object.', [])]);
  }
  if (input.document.kind !== 'locationWorldGeneration') {
    issues.push(issue('kind must be "locationWorldGeneration".', ['kind']));
  }
  if (input.document.version !== 1) {
    issues.push(issue('version must be 1.', ['version']));
  }
  const locationId = typeof input.document.locationId === 'string'
    ? input.document.locationId
    : '';
  if (!locationId) {
    issues.push(issue('locationId is required.', ['locationId']));
  }
  if (
    input.document.prompt !== undefined
    && (typeof input.document.prompt !== 'string'
      || input.document.prompt.trim().length === 0)
  ) {
    issues.push(issue('prompt must be a non-empty string when provided.', ['prompt']));
  }
  const rawSource = readSource(input.document.source, issues);

  const locationRecord = locationId
    ? readLocationRecord(input.session, locationId)
    : null;
  if (locationId && !locationRecord) {
    issues.push(issue('Location was not found.', ['locationId']));
  }
  if (issues.length > 0 || !rawSource || !locationRecord) {
    throw invalidInput(issues);
  }

  const images: ValidatedLocationWorldImage[] = [];
  for (const rawImage of rawSource.images) {
    try {
      const projectRelativePath = normalizeProjectRelativePath(
        rawImage.projectRelativePath
      );
      const absolutePath = resolveProjectRelativePath(
        input.projectFolder,
        projectRelativePath
      );
      assertResolvedPathInsideProject(input.projectFolder, absolutePath);
      const stats = await fs.stat(absolutePath);
      if (!stats.isFile()) {
        throw new Error('not a regular file');
      }
      const extension = path.extname(absolutePath).slice(1).toLowerCase();
      if (!IMAGE_EXTENSIONS.has(extension)) {
        issues.push(sourceIssue(
          'Source image must use JPG, JPEG, PNG, or WEBP.',
          rawImage.path
        ));
        continue;
      }
      images.push({
        projectRelativePath,
        absolutePath,
        fileName: path.basename(absolutePath),
        extension: extension as 'jpg' | 'jpeg' | 'png' | 'webp',
        mimeType: extension === 'png'
          ? 'image/png'
          : extension === 'webp'
            ? 'image/webp'
            : 'image/jpeg',
      });
    } catch {
      issues.push(sourceIssue(
        'Source image must be an existing regular file inside the Project.',
        rawImage.path
      ));
    }
  }
  if (issues.length > 0) {
    throw new ProjectDataError(
      'LOCATION_WORLD_SOURCE_INVALID',
      'Location World source images are invalid.',
      { issues }
    );
  }
  const location = locationRecord;
  return {
    document: input.document as unknown as LocationWorldGenerationDocument,
    location: {
      id: location.id,
      handle: location.handle,
      name: location.name,
      ...(location.timePeriod ? { timePeriod: location.timePeriod } : {}),
      ...(location.description ? { description: location.description } : {}),
      ...(location.visualNotes ? { visualNotes: location.visualNotes } : {}),
    },
    source: rawSource.kind === 'panorama'
      ? { kind: 'panorama', image: images[0]! }
      : { kind: 'multiImage', images },
  };
}

function readSource(
  value: unknown,
  issues: DiagnosticIssue[]
): RawLocationWorldSource | null {
  if (!isRecord(value)) {
    issues.push(issue('source must be an object.', ['source']));
    return null;
  }
  if (value.kind === 'panorama') {
    rejectUnsupportedFields(value, ['kind', 'projectRelativePath'], ['source'], issues);
    const projectRelativePath = readProjectRelativePath(
      value.projectRelativePath,
      ['source', 'projectRelativePath'],
      issues
    );
    return projectRelativePath
      ? { kind: 'panorama', images: [{ projectRelativePath, path: ['source', 'projectRelativePath'] }] }
      : null;
  }
  if (value.kind === 'multiImage') {
    rejectUnsupportedFields(value, ['kind', 'images'], ['source'], issues);
    if (!Array.isArray(value.images)) {
      issues.push(issue('source.images must be an array.', ['source', 'images']));
      return null;
    }
    if (value.images.length < 2 || value.images.length > 8) {
      issues.push(issue(
        'source.images must contain between two and eight entries.',
        ['source', 'images']
      ));
    }
    const images: RawSourceImage[] = [];
    value.images.forEach((image, index) => {
      const imagePath = ['source', 'images', String(index)];
      if (!isRecord(image)) {
        issues.push(issue('Image entry must be an object.', imagePath));
        return;
      }
      rejectUnsupportedFields(image, ['projectRelativePath'], imagePath, issues);
      const projectRelativePath = readProjectRelativePath(
        image.projectRelativePath,
        [...imagePath, 'projectRelativePath'],
        issues
      );
      if (projectRelativePath) {
        images.push({
          projectRelativePath,
          path: [...imagePath, 'projectRelativePath'],
        });
      }
    });
    return { kind: 'multiImage', images };
  }
  issues.push(issue(
    'source.kind must be "panorama" or "multiImage".',
    ['source', 'kind']
  ));
  return null;
}

function readProjectRelativePath(
  value: unknown,
  path: string[],
  issues: DiagnosticIssue[]
): string | null {
  if (typeof value !== 'string' || !value) {
    issues.push(issue('projectRelativePath is required.', path));
    return null;
  }
  return value;
}

function rejectUnsupportedFields(
  value: Record<string, unknown>,
  supported: string[],
  path: string[],
  issues: DiagnosticIssue[]
): void {
  for (const field of Object.keys(value)) {
    if (!supported.includes(field)) {
      issues.push(issue('Source field is not supported.', [...path, field]));
    }
  }
}

function invalidInput(issues: DiagnosticIssue[]): ProjectDataError {
  return new ProjectDataError(
    'LOCATION_WORLD_INPUT_INVALID',
    'Location World generation input is invalid.',
    { issues }
  );
}

function issue(message: string, path: string[]): DiagnosticIssue {
  return createDiagnosticError(
    'LOCATION_WORLD_INPUT_INVALID',
    message,
    { path, context: 'Location World generation document' }
  );
}

function sourceIssue(message: string, path: string[]): DiagnosticIssue {
  return createDiagnosticError(
    'LOCATION_WORLD_SOURCE_INVALID',
    message,
    {
      path,
      context: 'Location World generation document',
    }
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}
