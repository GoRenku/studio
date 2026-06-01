/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, type ReactNode } from 'react';
import type { SceneShot } from '@gorenku/studio-core/client';
import type { SceneShotListResourceResponse } from '@/services/studio-project-contracts';
import {
  useShotCameraDesign,
  type UseShotCameraDesignResult,
} from './use-shot-camera-design';

const ShotCameraDesignContext = createContext<UseShotCameraDesignResult | null>(
  null
);

interface ShotCameraDesignProviderProps {
  projectName: string;
  sceneId: string;
  shot: SceneShot;
  onSaved?: (resource: SceneShotListResourceResponse) => void;
  children: ReactNode;
}

/**
 * Owns one shared camera-design state per shot so the Camera Framing and Camera
 * Motion tabs edit the same object (0036). The server persists `cameraDesign`
 * wholesale, so a single source of truth is required to avoid one tab clobbering
 * the other's selections. Mount this keyed by `shot.shotId` for a clean reset on
 * shot switch.
 */
export function ShotCameraDesignProvider({
  projectName,
  sceneId,
  shot,
  onSaved,
  children,
}: ShotCameraDesignProviderProps) {
  const value = useShotCameraDesign({
    projectName,
    sceneId,
    shotId: shot.shotId,
    initial: shot.cameraDesign,
    onSaved,
  });
  return (
    <ShotCameraDesignContext.Provider value={value}>
      {children}
    </ShotCameraDesignContext.Provider>
  );
}

export function useShotCameraDesignContext(): UseShotCameraDesignResult {
  const value = useContext(ShotCameraDesignContext);
  if (!value) {
    throw new Error(
      'useShotCameraDesignContext must be used within a ShotCameraDesignProvider.'
    );
  }
  return value;
}
