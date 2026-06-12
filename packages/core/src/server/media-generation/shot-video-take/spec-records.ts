import type {
  MediaGenerationSpecRecord,
} from '../../../client/index.js';
import {
  requireMediaGenerationSpec,
} from '../../database/access/media-generation.js';
import type {
  ReadMediaGenerationSpecInput,
} from '../../project-data-service-contracts.js';
import {
  withShotProjectSession,
} from './project-session.js';



export async function readShotSpec(
  input: ReadMediaGenerationSpecInput
): Promise<MediaGenerationSpecRecord> {
  return withShotProjectSession(input, ({ session }) =>
    requireMediaGenerationSpec(session, input.specId)
  );
}



export const readShotFirstFrameSpec = readShotSpec;


export const readShotLastFrameSpec = readShotSpec;


export const readShotReferenceImageSpec = readShotSpec;


export const readShotMultiShotStoryboardSheetSpec = readShotSpec;


export const readShotVideoTakeSpec = readShotSpec;
