/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, type ReactNode } from 'react';
import type { SceneShot } from '@gorenku/studio-core/client';
import type { SceneShotListResourceResponse } from '@/services/studio-project-contracts';
import {
  useShotSpecs,
  type UseShotSpecsResult,
} from './use-shot-specs';

const ShotSpecsContext = createContext<UseShotSpecsResult | null>(
  null
);

interface ShotSpecsProviderProps {
  projectName: string;
  sceneId: string;
  shot: SceneShot;
  onSaved?: (resource: SceneShotListResourceResponse) => void;
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
  children,
}: ShotSpecsProviderProps) {
  const value = useShotSpecs({
    projectName,
    sceneId,
    shotId: shot.shotId,
    initial: shot.shotSpecs,
    onSaved,
  });
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
