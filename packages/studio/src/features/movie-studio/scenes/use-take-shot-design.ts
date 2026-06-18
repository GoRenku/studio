import { useCallback, useState } from 'react';
import type { SceneShotVideoTakeShotDesign } from '@gorenku/studio-core/client';
import {
  useDebouncedAutosave,
  type DebouncedSaveStatus,
} from '@/hooks/use-debounced-autosave';
import { updateSceneShotVideoTakeShotDesign } from '@/services/studio-shot-video-takes-api';

export interface UseTakeShotDesignInput {
  projectName: string;
  sceneId: string;
  takeId?: string | null;
  shotId: string;
  initial: SceneShotVideoTakeShotDesign | undefined;
  onSaved?: () => void;
}

export interface UseTakeShotDesignResult {
  shotDesign: SceneShotVideoTakeShotDesign;
  update: (next: SceneShotVideoTakeShotDesign) => void;
  status: DebouncedSaveStatus;
}

export function useTakeShotDesign(
  input: UseTakeShotDesignInput
): UseTakeShotDesignResult {
  const { projectName, sceneId, takeId, shotId, initial, onSaved } = input;
  const [shotDesign, setShotDesign] = useState<SceneShotVideoTakeShotDesign>(initial ?? {});

  const save = useCallback(
    (value: SceneShotVideoTakeShotDesign) => {
      if (!takeId) {
        return Promise.resolve();
      }
      return updateSceneShotVideoTakeShotDesign(
        projectName,
        sceneId,
        takeId,
        shotId,
        isEmptyShotDesign(value) ? null : value
      ).then(() => undefined);
    },
    [projectName, sceneId, takeId, shotId]
  );

  const status = useDebouncedAutosave({
    value: shotDesign,
    save,
    failureMessage: 'Shot settings could not be saved.',
    isReady: () => Boolean(takeId),
    onSaved,
  });

  return { shotDesign, update: setShotDesign, status };
}

function isEmptyShotDesign(
  shotDesign: SceneShotVideoTakeShotDesign
): boolean {
  return (
    !hasComposition(shotDesign.composition) &&
    !hasMovement(shotDesign.motion) &&
    !hasLocation(shotDesign.location) &&
    !hasCast(shotDesign.cast) &&
    !hasLookbook(shotDesign.lookbook) &&
    !hasReferenceImages(shotDesign.referenceImages)
  );
}

function hasComposition(
  composition: SceneShotVideoTakeShotDesign['composition']
): boolean {
  if (!composition) return false;
  return Boolean(
    composition.shotSize ||
      composition.cameraAngle ||
      composition.dutch ||
      composition.subjectFraming?.length ||
      hasLens(composition.lens) ||
      composition.customComposition?.trim()
  );
}

function hasMovement(
  movement: SceneShotVideoTakeShotDesign['motion']
): boolean {
  if (!movement) return false;
  return Boolean(
    movement.movement ||
      movement.secondary ||
      movement.track ||
      movement.rig ||
      movement.directions?.length ||
      movement.customMotion?.trim()
  );
}

function hasLens(
  lens: NonNullable<SceneShotVideoTakeShotDesign['composition']>['lens']
): boolean {
  if (!lens) return false;
  return Boolean(
    lens.type ||
      lens.millimeters !== undefined ||
      lens.focus
  );
}

function hasLocation(
  location: SceneShotVideoTakeShotDesign['location']
): boolean {
  if (!location) return false;
  return Boolean(
    location.locationId?.trim() ||
      location.environmentSheetAssetId?.trim() ||
      location.viewIds?.length
  );
}

function hasCast(cast: SceneShotVideoTakeShotDesign['cast']): boolean {
  if (!cast) return false;
  return Boolean(
    cast.castMemberIds?.length ||
      Object.keys(cast.characterSheetAssetIds ?? {}).length
  );
}

function hasLookbook(
  lookbook: SceneShotVideoTakeShotDesign['lookbook']
): boolean {
  if (!lookbook) return false;
  return Boolean(lookbook.lookbookId?.trim() || lookbook.lookbookSheetId?.trim());
}

function hasReferenceImages(
  referenceImages: SceneShotVideoTakeShotDesign['referenceImages']
): boolean {
  if (!referenceImages) return false;
  return Boolean(referenceImages.customMediaInputIds?.length);
}
