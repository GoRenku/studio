/* eslint-disable react-refresh/only-export-components */
import { createContext, useContext, useEffect, type ReactNode } from 'react';
import type {
  SceneShot,
  SceneShotVideoTakeDirection,
} from '@gorenku/studio-core/client';
import type { SaveNotificationStatus } from '@/ui/save-notification';
import type {
  SceneShotVideoTakeWithHttp,
  ShotVideoTakeWorkspaceMutation,
} from '@/services/studio-shot-video-takes-api';
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
  take?: SceneShotVideoTakeWithHttp | null;
  onSaved?: (result: ShotVideoTakeWorkspaceMutation) => void;
  onSaveNotificationChange?: (status: SaveNotificationStatus) => void;
  children: ReactNode;
}

/**
 * Owns one shared take shot design state per editable direction scope so the
 * Composition, Camera Motion, and Location tabs edit the same object.
 */
export function TakeShotDesignProvider({
  take,
  shot,
  ...props
}: TakeShotDesignProviderProps) {
  return (
    <TakeShotDesignScope
      key={takeShotDesignScopeKey(take, shot.shotId)}
      take={take}
      shot={shot}
      {...props}
    />
  );
}

function TakeShotDesignScope({
  projectName,
  sceneId,
  shot,
  take,
  onSaved,
  onSaveNotificationChange,
  children,
}: TakeShotDesignProviderProps) {
  const initial = take ? directionForShot(take, shot.shotId) : undefined;
  const value = useTakeShotDesign({
    projectName,
    sceneId,
    takeId: take?.takeId,
    shotId: take?.state.structure.mode === 'multi-cut' ? shot.shotId : undefined,
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

function directionForShot(
  take: SceneShotVideoTakeWithHttp,
  shotId: string
): SceneShotVideoTakeDirection | undefined {
  if (take.state.structure.mode === 'continuous') {
    return take.state.structure.sharedDirection;
  }
  return take.state.structure.directionsByShotId[shotId];
}

function takeShotDesignScopeKey(
  take: SceneShotVideoTakeWithHttp | null | undefined,
  shotId: string
): string {
  if (!take) {
    return `shot-list:${shotId}`;
  }
  if (take.state.structure.mode === 'continuous') {
    return `take:${take.takeId}:continuous`;
  }
  return `take:${take.takeId}:multi-cut:${shotId}`;
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
