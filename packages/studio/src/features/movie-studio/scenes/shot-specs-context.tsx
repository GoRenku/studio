/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, type ReactNode } from 'react';
import type { SceneShot } from '@gorenku/studio-core/client';
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
  onSaved?: (resource: SceneShotListResourceResponse) => void;
  onSaveNotificationChange?: (status: SaveNotificationStatus) => void;
  children: ReactNode;
}

/**
 * Owns one shared shot specs state per shot so the Composition, Camera
 * Motion, and Location tabs edit the same object. The server persists `shotSpecs`
 * wholesale, so a single source of truth is required to avoid one tab clobbering
 * the other's selections. Mount this keyed by `shot.shotId` for a clean reset on
 * shot switch.
 */
export function ShotSpecsProvider({
  projectName,
  sceneId,
  shot,
  onSaved,
  onSaveNotificationChange,
  children,
}: ShotSpecsProviderProps) {
  const value = useShotSpecs({
    projectName,
    sceneId,
    shotId: shot.shotId,
    initial: shot.shotSpecs,
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

export function useShotSpecsContext(): UseShotSpecsResult {
  const value = useContext(ShotSpecsContext);
  if (!value) {
    throw new Error(
      'useShotSpecsContext must be used within a ShotSpecsProvider.'
    );
  }
  return value;
}
