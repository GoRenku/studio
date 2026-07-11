import type {
  MediaGenerationDependencySlot,
  ShotVideoInputReferenceMode,
  ShotVideoTakeInputKind,
  ShotVideoTakeProductionContext,
} from '../../../../../client/index.js';
import {
  castCharacterSheetDependencySlot,
  locationEnvironmentSheetDependencySlot,
  lookbookSheetDependencySlot,
} from '../../../dependencies/dependency-slot-definitions.js';
import {
  readSelectedStoryboardLookbookId,
  requireLookbookRecordById,
  toLookbook,
} from '../../../../database/access/lookbook.js';
import type {
  DatabaseSession,
} from '../../../../database/lifecycle/store.js';
import {
  ProjectDataError,
} from '../../../../project-data-error.js';
import type {
  MediaGenerationDependencyDeclarationInput,
} from '../../../lifecycle/purpose-definition.js';
import {
  buildContextFromPrepared,
} from '../authoring/context.js';
import {
  withShotProjectSession,
} from '../shared/project-session.js';
import {
  selectedCharacterSheetAssetIdsForGenerationTakeState,
  selectedLocationSheetAssetIdsForGenerationTakeState,
  selectedLookbookSheetIdsForGenerationTakeState,
} from '../selection/reference-selection.js';
import {
  prepareSceneShotVideoTakeInSession,
} from '../authoring/take-context.js';

export async function declareShotVideoInputDependencies(
  input: MediaGenerationDependencyDeclarationInput
): Promise<MediaGenerationDependencySlot[]> {
  if (input.target.kind !== 'sceneShotVideoTake') {
    throw new ProjectDataError(
      'CORE_SHOT_VIDEO_INPUT_DEPENDENCY_DECLARATION_TARGET_INVALID',
      `Shot input dependencies require a sceneShotVideoTake target. Received: ${input.target.kind}.`
    );
  }
  if (input.request.kind !== 'media-generation-spec') {
    throw new ProjectDataError(
      'CORE_SHOT_VIDEO_INPUT_DEPENDENCY_DECLARATION_REQUEST_INVALID',
      `Shot input dependencies require a media-generation-spec request. Received: ${input.request.kind}.`
    );
  }
  const target = input.target;
  const spec = input.request.spec as { referenceMode?: ShotVideoInputReferenceMode; outputInputKind?: ShotVideoTakeInputKind } | undefined;
  if (!spec?.referenceMode) {
    throw new ProjectDataError(
      'CORE_SHOT_VIDEO_INPUT_REFERENCE_MODE_REQUIRED',
      'Shot input dependency declarations require referenceMode.'
    );
  }
  const referenceMode = spec.referenceMode;
  const inputKind = spec.outputInputKind ?? 'reference-image';
  return withShotProjectSession(input, ({ session, projectFolder, project }) => {
    const prepared = prepareSceneShotVideoTakeInSession({
      session,
      input: {
        projectName: input.projectName,
        homeDir: input.homeDir,
        sceneId: target.sceneId,
        takeId: target.takeId,
      },
    });
    const context = buildContextFromPrepared({
      session,
      projectFolder,
      project,
      prepared,
    });
    return declareShotVideoInputReferenceDependencies({
      session,
      context,
      inputKind,
      referenceMode,
    });
  });
}

export function declareShotVideoInputReferenceDependencies(input: {
  session: DatabaseSession;
  context: ShotVideoTakeProductionContext;
  inputKind: ShotVideoTakeInputKind;
  referenceMode: ShotVideoInputReferenceMode;
}): MediaGenerationDependencySlot[] {
  return [
    ...shotVideoInputStyleDependency(input),
    ...shotVideoInputContinuityDependencies(input.context),
  ];
}

function shotVideoInputStyleDependency(input: {
  session: DatabaseSession;
  context: ShotVideoTakeProductionContext;
  inputKind: ShotVideoTakeInputKind;
  referenceMode: ShotVideoInputReferenceMode;
}): MediaGenerationDependencySlot[] {
  const reason =
    input.referenceMode === 'storyboard-lookbook'
      ? 'Shot input image generation uses the selected Storyboard Lookbook sheet as the explicit storyboard style reference.'
      : 'Shot input image generation uses the selected Movie Lookbook sheet as the default visual style reference.';
  if (input.referenceMode === 'movie-lookbook') {
    if (!input.context.activeLookbook) {
      return [];
    }
    return [
      {
        ...lookbookSheetDependencySlot({
          lookbookId: input.context.activeLookbook.id,
          lookbookName: input.context.activeLookbook.name,
          ...(selectedMovieLookbookSheetId(input.context)
            ? { lookbookSheetId: selectedMovieLookbookSheetId(input.context)! }
            : {}),
          required: true,
          reason,
        }),
        defaultIncluded: true,
      },
    ];
  }
  const storyboardLookbook = selectedStoryboardLookbook(input.session);
  if (!storyboardLookbook) {
    return [];
  }
  return [
    {
      ...lookbookSheetDependencySlot({
        lookbookId: storyboardLookbook.id,
        lookbookName: storyboardLookbook.name,
        required: true,
        reason,
      }),
      defaultIncluded: true,
    },
  ];
}

function shotVideoInputContinuityDependencies(
  context: ShotVideoTakeProductionContext
): MediaGenerationDependencySlot[] {
  const reason =
    'Shot input image generation uses this selected reference as visual continuity conditioning.';
  return [
    ...context.selectedLocations.flatMap((location) => {
      const selectedAssetIds = selectedLocationSheetAssetIdsForGenerationTakeState(
        context.take.state,
        context.take.shotIds,
        location.id
      );
      if (selectedAssetIds.length === 0) {
        return [
          {
            ...locationEnvironmentSheetDependencySlot({
              locationId: location.id,
              locationName: location.name,
              required: true,
              reason,
            }),
            defaultIncluded: true,
          },
        ];
      }
      return selectedAssetIds.map((assetId) => ({
        ...locationEnvironmentSheetDependencySlot({
          locationId: location.id,
          locationName: location.name,
          assetId,
          required: true,
          reason,
        }),
        defaultIncluded: true,
      }));
    }),
    ...context.selectedCast
      .filter((castMember) => !castMember.isVoiceOver)
      .flatMap((castMember) => {
        const selectedAssetIds = selectedCharacterSheetAssetIdsForGenerationTakeState(
          context.take.state,
          context.take.shotIds,
          castMember.id
        );
        if (selectedAssetIds.length === 0) {
          return [
            {
              ...castCharacterSheetDependencySlot({
                castMemberId: castMember.id,
                castMemberName: castMember.name,
                selectionPolicy: 'selected-only',
                required: true,
                reason,
              }),
              defaultIncluded: true,
            },
          ];
        }
        return selectedAssetIds.map((assetId) => ({
          ...castCharacterSheetDependencySlot({
            castMemberId: castMember.id,
            castMemberName: castMember.name,
            assetId,
            selectionPolicy: 'selected-only',
            required: true,
            reason,
          }),
          defaultIncluded: true,
        }));
      }),
  ];
}

function selectedMovieLookbookSheetId(
  context: ShotVideoTakeProductionContext
): string | null {
  return (
    [...selectedLookbookSheetIdsForGenerationTakeState(
      context.take.state,
      context.take.shotIds
    )][0] ?? null
  );
}

function selectedStoryboardLookbook(
  session: DatabaseSession
): { id: string; name: string } | null {
  const lookbookId = readSelectedStoryboardLookbookId(session);
  if (!lookbookId) {
    return null;
  }
  const lookbook = toLookbook(requireLookbookRecordById(session, lookbookId));
  if (lookbook.type !== 'storyboard') {
    return null;
  }
  return {
    id: lookbook.id,
    name: lookbook.name,
  };
}
