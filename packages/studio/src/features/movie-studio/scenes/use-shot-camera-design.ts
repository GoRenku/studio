import { useCallback, useState } from 'react';
import type { ShotCameraDesign } from '@gorenku/studio-core/client';
import {
  useDebouncedAutosave,
  type DebouncedAutosaveStatus,
} from '@/hooks/use-debounced-autosave';
import type { SceneShotListResourceResponse } from '@/services/studio-project-contracts';
import { updateSceneShotCameraDesign } from '@/services/studio-screenplay-api';

export interface UseShotCameraDesignInput {
  projectName: string;
  sceneId: string;
  shotId: string;
  initial: ShotCameraDesign | undefined;
  onSaved?: (resource: SceneShotListResourceResponse) => void;
}

export interface UseShotCameraDesignResult {
  design: ShotCameraDesign;
  update: (next: ShotCameraDesign) => void;
  status: DebouncedAutosaveStatus;
}

/**
 * Local camera-design state for one shot with debounced autosave (0036). The
 * consuming tab content is keyed by `shotId`, so this hook re-initialises from
 * the shot's stored design on shot switch without a spurious save.
 */
export function useShotCameraDesign(
  input: UseShotCameraDesignInput
): UseShotCameraDesignResult {
  const { projectName, sceneId, shotId, initial, onSaved } = input;
  const [design, setDesign] = useState<ShotCameraDesign>(initial ?? {});

  const save = useCallback(
    (value: ShotCameraDesign) =>
      updateSceneShotCameraDesign(
        projectName,
        sceneId,
        shotId,
        isEmptyDesign(value) ? null : value
      ),
    [projectName, sceneId, shotId]
  );

  const status = useDebouncedAutosave({
    value: design,
    save,
    onSaved: (resource) => onSaved?.(resource),
  });

  return { design, update: setDesign, status };
}

function isEmptyDesign(design: ShotCameraDesign): boolean {
  return (
    !design.shotSize &&
    !design.cameraAngle &&
    !design.dutch &&
    !(design.subjectFraming && design.subjectFraming.length) &&
    !hasMovement(design.movement) &&
    !hasCustom(design.custom)
  );
}

function hasMovement(movement: ShotCameraDesign['movement']): boolean {
  if (!movement) return false;
  return Boolean(
    movement.movement ||
      movement.secondary ||
      movement.track ||
      movement.rig ||
      (movement.directions && movement.directions.length)
  );
}

function hasCustom(custom: ShotCameraDesign['custom']): boolean {
  if (!custom) return false;
  return Boolean(custom.framing?.trim() || custom.movement?.trim());
}
