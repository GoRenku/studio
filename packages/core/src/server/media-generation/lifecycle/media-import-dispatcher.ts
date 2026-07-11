import {
  CAST_CHARACTER_SHEET_GENERATION_PURPOSE,
  CAST_PROFILE_GENERATION_PURPOSE,
  LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE,
  LOCATION_HERO_GENERATION_PURPOSE,
  LOOKBOOK_IMAGE_GENERATION_PURPOSE,
  LOOKBOOK_SHEET_GENERATION_PURPOSE,
  SCENE_STORYBOARD_SHEET_GENERATION_PURPOSE,
  SHOT_INPUT_MEDIA_IMPORT_PURPOSE,
  SHOT_VIDEO_TAKE_GENERATION_PURPOSE,
} from '../../../client/index.js';
import type {
  ImportCastMediaInput,
  ImportLocationEnvironmentSheetMediaInput,
  ImportLocationHeroMediaInput,
  ImportLookbookImageMediaInput,
  ImportLookbookSheetMediaInput,
  ImportSceneStoryboardImagesMediaInput,
  ImportShotVideoTakeInputMediaInput,
  ImportShotVideoTakeMediaInput,
} from '../../project-data-service-contracts.js';
import { ProjectDataError } from '../../project-data-error.js';
import * as characterSheet from '../purposes/cast-character-sheet.js';
import * as castProfile from '../purposes/cast-profile.js';
import * as locationSheet from '../purposes/location-environment-sheet.js';
import * as locationHero from '../purposes/location-hero.js';
import * as lookbookImage from '../purposes/lookbook-image.js';
import * as lookbookSheet from '../purposes/lookbook-sheet.js';
import * as sceneStoryboardSheet from '../purposes/scene-storyboard-sheet.js';
import {
  importShotInputMedia,
  importShotVideoTake,
} from '../purposes/shot-video-take/imports/media-imports.js';
import type { MediaGenerationImportReport } from './purpose-definition.js';

type MediaGenerationImportInput =
  | ({ purpose: typeof LOOKBOOK_IMAGE_GENERATION_PURPOSE } & ImportLookbookImageMediaInput)
  | ({ purpose: typeof LOOKBOOK_SHEET_GENERATION_PURPOSE } & ImportLookbookSheetMediaInput)
  | ({ purpose: typeof CAST_CHARACTER_SHEET_GENERATION_PURPOSE } & ImportCastMediaInput)
  | ({ purpose: typeof CAST_PROFILE_GENERATION_PURPOSE } & ImportCastMediaInput)
  | ({ purpose: typeof LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE } & ImportLocationEnvironmentSheetMediaInput)
  | ({ purpose: typeof LOCATION_HERO_GENERATION_PURPOSE } & ImportLocationHeroMediaInput)
  | ({ purpose: typeof SCENE_STORYBOARD_SHEET_GENERATION_PURPOSE } & ImportSceneStoryboardImagesMediaInput)
  | ({ purpose: typeof SHOT_INPUT_MEDIA_IMPORT_PURPOSE } & ImportShotVideoTakeInputMediaInput)
  | ({ purpose: typeof SHOT_VIDEO_TAKE_GENERATION_PURPOSE } & ImportShotVideoTakeMediaInput);

export async function importMediaGenerationByPurpose(
  input: MediaGenerationImportInput,
): Promise<MediaGenerationImportReport> {
  switch (input.purpose) {
    case LOOKBOOK_IMAGE_GENERATION_PURPOSE:
      return lookbookImage.importLookbookImageMedia(input);
    case LOOKBOOK_SHEET_GENERATION_PURPOSE:
      return lookbookSheet.importLookbookSheetMedia(input);
    case CAST_CHARACTER_SHEET_GENERATION_PURPOSE:
      return characterSheet.importCastCharacterSheetMedia(input);
    case CAST_PROFILE_GENERATION_PURPOSE:
      return castProfile.importCastProfileMedia(input);
    case LOCATION_ENVIRONMENT_SHEET_GENERATION_PURPOSE:
      return locationSheet.importLocationEnvironmentSheetMedia(input);
    case LOCATION_HERO_GENERATION_PURPOSE:
      return locationHero.importLocationHeroMedia(input);
    case SCENE_STORYBOARD_SHEET_GENERATION_PURPOSE:
      return sceneStoryboardSheet.importSceneStoryboardImagesMedia(input);
    case SHOT_INPUT_MEDIA_IMPORT_PURPOSE:
      return importShotInputMedia(input);
    case SHOT_VIDEO_TAKE_GENERATION_PURPOSE:
      return importShotVideoTake(input);
    default:
      return assertNever(input);
  }
}

function assertNever(value: never): never {
  throw new ProjectDataError(
    'PROJECT_DATA387',
    `Unsupported media generation purpose: ${(value as { purpose: string }).purpose}.`,
  );
}
