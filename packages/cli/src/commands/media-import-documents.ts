import {
  type SceneStoryboardImagesImportDocument,
} from '@gorenku/studio-core/server';
import { StructuredError } from '@gorenku/studio-diagnostics';
import { readJsonFile } from './structured-command.js';

export interface LocationEnvironmentSheetImportDocument {
  title?: string;
  oneLineSummary?: string;
  files: {
    composite: string;
    view_front: string;
    view_right: string;
    view_back: string;
    view_left: string;
  };
}

export async function readReceipt(filePath: string): Promise<unknown> {
  const parsed = (await readJsonFile(filePath)) as { receipt?: unknown };
  return parsed.receipt ?? parsed;
}

export async function readLocationEnvironmentSheetImportDocument(
  filePath: string
): Promise<LocationEnvironmentSheetImportDocument> {
  const parsed = await readJsonFile(filePath);
  if (!isRecord(parsed)) {
    throw invalidLocationEnvironmentSheetImportFile(filePath);
  }
  const files = parsed.files;
  if (!isRecord(files)) {
    throw invalidLocationEnvironmentSheetImportFile(filePath);
  }
  return {
    ...(typeof parsed.title === 'string' ? { title: parsed.title } : {}),
    ...(typeof parsed.oneLineSummary === 'string'
      ? { oneLineSummary: parsed.oneLineSummary }
      : {}),
    files: {
      composite: readLocationEnvironmentSheetImportFileRole(
        files,
        filePath,
        'composite'
      ),
      view_front: readLocationEnvironmentSheetImportFileRole(
        files,
        filePath,
        'view_front'
      ),
      view_right: readLocationEnvironmentSheetImportFileRole(
        files,
        filePath,
        'view_right'
      ),
      view_back: readLocationEnvironmentSheetImportFileRole(
        files,
        filePath,
        'view_back'
      ),
      view_left: readLocationEnvironmentSheetImportFileRole(
        files,
        filePath,
        'view_left'
      ),
    },
  };
}

export async function readSceneStoryboardImagesImportDocument(
  filePath: string
): Promise<SceneStoryboardImagesImportDocument> {
  const parsed = await readJsonFile(filePath);
  if (!isRecord(parsed) || parsed.kind !== 'sceneStoryboardImagesImport') {
    throw invalidSceneStoryboardImagesImportFile(filePath);
  }
  const shots = parsed.shots;
  if (!Array.isArray(shots) || typeof parsed.shotListId !== 'string') {
    throw invalidSceneStoryboardImagesImportFile(filePath);
  }
  return {
    kind: 'sceneStoryboardImagesImport',
    ...(typeof parsed.title === 'string' ? { title: parsed.title } : {}),
    shotListId: parsed.shotListId,
    shots: shots.map((shot) => readSceneStoryboardImagesImportShot(shot, filePath)),
  };
}

function readSceneStoryboardImagesImportShot(
  value: unknown,
  filePath: string
): SceneStoryboardImagesImportDocument['shots'][number] {
  if (
    !isRecord(value) ||
    typeof value.shotId !== 'string' ||
    typeof value.source !== 'string'
  ) {
    throw invalidSceneStoryboardImagesImportFile(filePath);
  }
  return {
    shotId: value.shotId,
    source: value.source,
    ...(typeof value.title === 'string' ? { title: value.title } : {}),
    ...(value.sourcePurpose === 'scene.storyboard-sheet'
      ? { sourcePurpose: value.sourcePurpose }
      : {}),
    ...(typeof value.sourceSpecId === 'string'
      ? { sourceSpecId: value.sourceSpecId }
      : {}),
    ...(typeof value.sourceRunId === 'string'
      ? { sourceRunId: value.sourceRunId }
      : {}),
  };
}

function readLocationEnvironmentSheetImportFileRole(
  files: Record<string, unknown>,
  filePath: string,
  role: 'composite' | 'view_front' | 'view_right' | 'view_back' | 'view_left'
): string {
  const value = files[role];
  if (typeof value !== 'string' || value.trim().length === 0) {
    throw invalidLocationEnvironmentSheetImportFile(filePath);
  }
  return value;
}

function invalidLocationEnvironmentSheetImportFile(
  filePath: string
): StructuredError {
  return new StructuredError({
    code: 'CLI029',
    message: `Invalid Location environment sheet import file: ${filePath}.`,
    suggestion:
      'Provide JSON with files.composite, files.view_front, files.view_right, files.view_back, and files.view_left.',
  });
}

function invalidSceneStoryboardImagesImportFile(
  filePath: string
): StructuredError {
  return new StructuredError({
    code: 'CLI029',
    message: `Invalid Scene storyboard image import file: ${filePath}.`,
    suggestion:
      'Provide JSON with kind "sceneStoryboardImagesImport", shotListId, and shots[] entries containing shotId and source.',
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
