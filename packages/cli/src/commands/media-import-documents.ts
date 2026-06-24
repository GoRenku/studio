import {
  type SceneStoryboardImagesImportDocument,
} from '@gorenku/studio-core/server';
import { StructuredError } from '@gorenku/studio-diagnostics';
import { readJsonFile } from './structured-command.js';

export async function readReceipt(filePath: string): Promise<unknown> {
  const parsed = (await readJsonFile(filePath)) as { receipt?: unknown };
  return parsed.receipt ?? parsed;
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
