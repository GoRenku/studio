import { useCallback, useState } from 'react';
import type { ShotSpecs } from '@gorenku/studio-core/client';
import {
  useDebouncedAutosave,
  type DebouncedAutosaveStatus,
} from '@/hooks/use-debounced-autosave';
import type { SceneShotListResourceResponse } from '@/services/studio-project-contracts';
import { updateSceneShotSpecs } from '@/services/studio-screenplay-api';

export interface UseShotSpecsInput {
  projectName: string;
  sceneId: string;
  shotId: string;
  initial: ShotSpecs | undefined;
  onSaved?: (resource: SceneShotListResourceResponse) => void;
}

export interface UseShotSpecsResult {
  shotSpecs: ShotSpecs;
  update: (next: ShotSpecs) => void;
  status: DebouncedAutosaveStatus;
}

/**
 * Local shot specs state for one shot with debounced autosave (0036). The
 * consuming tab content is keyed by `shotId`, so this hook re-initialises from
 * the shot's stored specs on shot switch without a spurious save.
 */
export function useShotSpecs(
  input: UseShotSpecsInput
): UseShotSpecsResult {
  const { projectName, sceneId, shotId, initial, onSaved } = input;
  const [shotSpecs, setShotSpecs] = useState<ShotSpecs>(initial ?? {});

  const save = useCallback(
    (value: ShotSpecs) =>
      updateSceneShotSpecs(
        projectName,
        sceneId,
        shotId,
        isEmptyShotSpecs(value) ? null : value
      ),
    [projectName, sceneId, shotId]
  );

  const status = useDebouncedAutosave({
    value: shotSpecs,
    save,
    onSaved: (resource) => onSaved?.(resource),
  });

  return { shotSpecs, update: setShotSpecs, status };
}

function isEmptyShotSpecs(shotSpecs: ShotSpecs): boolean {
  return (
    !shotSpecs.shotSize &&
    !shotSpecs.cameraAngle &&
    !shotSpecs.dutch &&
    !(shotSpecs.subjectFraming && shotSpecs.subjectFraming.length) &&
    !hasMovement(shotSpecs.movement) &&
    !hasLens(shotSpecs.lens) &&
    !hasLocation(shotSpecs.location) &&
    !hasCustom(shotSpecs.custom)
  );
}

function hasMovement(movement: ShotSpecs['movement']): boolean {
  if (!movement) return false;
  return Boolean(
    movement.movement ||
      movement.secondary ||
      movement.track ||
      movement.rig ||
      (movement.directions && movement.directions.length)
  );
}

function hasLens(lens: ShotSpecs['lens']): boolean {
  if (!lens) return false;
  return Boolean(
    lens.type ||
      lens.millimeters !== undefined ||
      lens.focus
  );
}

function hasLocation(location: ShotSpecs['location']): boolean {
  if (!location) return false;
  return Boolean(
    location.locationId?.trim() ||
      location.usesDifferentLocation !== undefined ||
      location.azimuthView ||
      location.customView?.trim()
  );
}

function hasCustom(custom: ShotSpecs['custom']): boolean {
  if (!custom) return false;
  return Boolean(custom.composition?.trim() || custom.movement?.trim());
}
