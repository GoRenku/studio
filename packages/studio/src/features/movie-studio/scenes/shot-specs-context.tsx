/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, type ReactNode } from 'react';
import type {
  SceneShot,
  SceneShotVideoTake,
  SceneShotVideoTakeShotDesign,
  ShotSpecs,
} from '@gorenku/studio-core/client';
import type { SceneShotListResourceResponse } from '@/services/studio-project-contracts';
import type { SaveNotificationStatus } from '@/ui/save-notification';
import {
  useShotSpecs,
  type UseShotSpecsResult,
} from './use-shot-specs';
import { idleSaveNotification } from '../detail-save-notification';

const ShotSpecsContext = createContext<UseShotSpecsResult | null>(
  null
);

interface ShotSpecsProviderProps {
  projectName: string;
  sceneId: string;
  shot: SceneShot;
  take?: SceneShotVideoTake | null;
  onSaved?: (resource: SceneShotListResourceResponse) => void;
  onSaveNotificationChange?: (status: SaveNotificationStatus) => void;
  children: ReactNode;
}

/**
 * Owns one shared shot specs state per shot so the Composition, Camera
 * Motion, and Location tabs edit the same object before the take-owned save
 * path translates it into focused take state. Mount this keyed by `shot.shotId`
 * for a clean reset on shot switch.
 */
export function ShotSpecsProvider({
  projectName,
  sceneId,
  shot,
  take,
  onSaved,
  onSaveNotificationChange,
  children,
}: ShotSpecsProviderProps) {
  const initial = takeShotDesignToShotSpecs(
    take?.state.shotDesignByShotId[shot.shotId]
  );
  const value = useShotSpecs({
    projectName,
    sceneId,
    takeId: take?.takeId,
    shotId: shot.shotId,
    initial,
    onSaved,
  });

  useEffect(() => {
    onSaveNotificationChange?.(value.status);
    return () => onSaveNotificationChange?.(idleSaveNotification);
  }, [onSaveNotificationChange, value.status]);

  return (
    <ShotSpecsContext.Provider value={value}>
      {children}
    </ShotSpecsContext.Provider>
  );
}

function takeShotDesignToShotSpecs(
  design: SceneShotVideoTakeShotDesign | undefined
): ShotSpecs | undefined {
  if (!design) {
    return undefined;
  }
  const shotSpecs: ShotSpecs = {};
  if (design.composition) {
    shotSpecs.shotSize = design.composition.shotSize;
    shotSpecs.subjectFraming = design.composition.subjectFraming;
    shotSpecs.cameraAngle = design.composition.cameraAngle;
    shotSpecs.dutch = design.composition.dutch;
    shotSpecs.lens = design.composition.lens;
    if (design.composition.customComposition) {
      shotSpecs.custom = {
        ...shotSpecs.custom,
        composition: design.composition.customComposition,
      };
    }
  }
  if (design.motion) {
    shotSpecs.movement = {
      movement: design.motion.movement,
      secondary: design.motion.secondary,
      directions: design.motion.directions,
      track: design.motion.track,
      rig: design.motion.rig,
    };
    if (design.motion.customMotion) {
      shotSpecs.custom = {
        ...shotSpecs.custom,
        movement: design.motion.customMotion,
      };
    }
  }
  if (design.cast) {
    shotSpecs.castReferences = { ...design.cast };
  }
  if (design.location) {
    shotSpecs.location = { ...design.location };
  }
  if (design.lookbook) {
    shotSpecs.lookbookReference = {
      lookbookSheetId: design.lookbook.lookbookSheetId,
    };
  }
  if (design.referenceImages) {
    shotSpecs.referenceImages = {
      customReferenceInputIds: design.referenceImages.customMediaInputIds,
    };
  }
  const pruned = JSON.parse(JSON.stringify(shotSpecs)) as ShotSpecs;
  return Object.keys(pruned).length > 0 ? pruned : undefined;
}

export function useShotSpecsContext(): UseShotSpecsResult {
  const value = useContext(ShotSpecsContext);
  if (!value) {
    throw new Error(
      'useShotSpecsContext must be used within a ShotSpecsProvider.'
    );
  }
  return value;
}
