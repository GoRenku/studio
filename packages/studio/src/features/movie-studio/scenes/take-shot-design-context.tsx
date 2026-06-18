/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, type ReactNode } from 'react';
import type {
  SceneShot,
  SceneShotVideoTake,
} from '@gorenku/studio-core/client';
import type { SaveNotificationStatus } from '@/ui/save-notification';
import {
  useTakeShotDesign,
  type UseTakeShotDesignResult,
} from './use-take-shot-design';
import { idleSaveNotification } from '../detail-save-notification';

const TakeShotDesignContext = createContext<UseTakeShotDesignResult | null>(
  null
);

interface TakeShotDesignProviderProps {
  projectName: string;
  sceneId: string;
  shot: SceneShot;
  take?: SceneShotVideoTake | null;
  onSaved?: () => void;
  onSaveNotificationChange?: (status: SaveNotificationStatus) => void;
  children: ReactNode;
}

/**
 * Owns one shared take shot design state per shot so the Composition, Camera
 * Motion, and Location tabs edit the same object. Mount this keyed by `shot.shotId`
 * for a clean reset on shot switch.
 */
export function TakeShotDesignProvider({
  projectName,
  sceneId,
  shot,
  take,
  onSaved,
  onSaveNotificationChange,
  children,
}: TakeShotDesignProviderProps) {
  const initial = take?.state.shotDesignByShotId[shot.shotId];
  const value = useTakeShotDesign({
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
    <TakeShotDesignContext.Provider value={value}>
      {children}
    </TakeShotDesignContext.Provider>
  );
}

export function useTakeShotDesignContext(): UseTakeShotDesignResult {
  const value = useContext(TakeShotDesignContext);
  if (!value) {
    throw new Error(
      'useTakeShotDesignContext must be used within a TakeShotDesignProvider.'
    );
  }
  return value;
}
