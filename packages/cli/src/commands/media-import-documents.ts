import {
  type SceneStoryboardSheetImportDocument,
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

export async function readSceneStoryboardSheetImportDocument(
  filePath: string
): Promise<SceneStoryboardSheetImportDocument> {
  const parsed = await readJsonFile(filePath);
  if (!isRecord(parsed) || parsed.kind !== 'sceneStoryboardSheetImport') {
    throw invalidSceneStoryboardSheetImportFile(filePath);
  }
  const sheets = parsed.sheets;
  if (!Array.isArray(sheets)) {
    throw invalidSceneStoryboardSheetImportFile(filePath);
  }
  return {
    kind: 'sceneStoryboardSheetImport',
    ...(typeof parsed.title === 'string' ? { title: parsed.title } : {}),
    sheets: sheets.map((sheet) =>
      readSceneStoryboardSheetImportSheet(sheet, filePath)
    ),
  };
}

function readSceneStoryboardSheetImportSheet(
  value: unknown,
  filePath: string
): SceneStoryboardSheetImportDocument['sheets'][number] {
  if (!isRecord(value) || typeof value.source !== 'string') {
    throw invalidSceneStoryboardSheetImportFile(filePath);
  }
  const shots = value.shots;
  if (!Array.isArray(shots)) {
    throw invalidSceneStoryboardSheetImportFile(filePath);
  }
  return {
    source: value.source,
    ...(typeof value.title === 'string' ? { title: value.title } : {}),
    shots: shots.map((shot) =>
      readSceneStoryboardSheetImportShot(shot, filePath)
    ),
  };
}

function readSceneStoryboardSheetImportShot(
  value: unknown,
  filePath: string
): SceneStoryboardSheetImportDocument['sheets'][number]['shots'][number] {
  if (
    !isRecord(value) ||
    typeof value.shotId !== 'string' ||
    typeof value.source !== 'string'
  ) {
    throw invalidSceneStoryboardSheetImportFile(filePath);
  }
  return {
    shotId: value.shotId,
    source: value.source,
    ...(typeof value.title === 'string' ? { title: value.title } : {}),
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

function invalidSceneStoryboardSheetImportFile(
  filePath: string
): StructuredError {
  return new StructuredError({
    code: 'CLI029',
    message: `Invalid Scene storyboard sheet import file: ${filePath}.`,
    suggestion:
      'Provide JSON with kind and sheets[] entries containing source plus shots[] with shotId and source.',
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
