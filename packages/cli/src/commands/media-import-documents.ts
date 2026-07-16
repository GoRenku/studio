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
  const beats = parsed.beats;
  if (!Array.isArray(beats) || typeof parsed.beatSheetId !== 'string') {
    throw invalidSceneStoryboardImagesImportFile(filePath);
  }
  return {
    kind: 'sceneStoryboardImagesImport',
    ...(typeof parsed.title === 'string' ? { title: parsed.title } : {}),
    beatSheetId: parsed.beatSheetId,
    beats: beats.map((beat) => readSceneStoryboardImagesImportBeat(beat, filePath)),
  };
}

function readSceneStoryboardImagesImportBeat(
  value: unknown,
  filePath: string
): SceneStoryboardImagesImportDocument['beats'][number] {
  if (
    !isRecord(value) ||
    typeof value.beatId !== 'string' ||
    typeof value.source !== 'string'
  ) {
    throw invalidSceneStoryboardImagesImportFile(filePath);
  }
  return {
    beatId: value.beatId,
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
      'Provide JSON with kind "sceneStoryboardImagesImport", beatSheetId, and beats[] entries containing beatId and source.',
  });
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null && !Array.isArray(value);
}
