import { useCallback, useState } from 'react';
import {
  sceneShotVideoTakeDirectionHasState,
  type SceneShotVideoTakeDirection,
} from '@gorenku/studio-core/client';
import {
  useDebouncedAutosave,
  type DebouncedSaveStatus,
} from '@/hooks/use-debounced-autosave';
import {
  updateSceneShotVideoTakeDirection,
  type ShotVideoTakeProductionMutation,
} from '@/services/studio-shot-video-takes-api';

export interface UseTakeShotDesignInput {
  projectName: string;
  sceneId: string;
  takeId?: string | null;
  shotId?: string;
  initial: SceneShotVideoTakeDirection | undefined;
  onSaved?: (result: ShotVideoTakeProductionMutation) => void;
}

export interface UseTakeShotDesignResult {
  shotDesign: SceneShotVideoTakeDirection;
  update: (next: SceneShotVideoTakeDirection) => void;
  status: DebouncedSaveStatus;
}

export function useTakeShotDesign(
  input: UseTakeShotDesignInput
): UseTakeShotDesignResult {
  const { projectName, sceneId, takeId, shotId, initial, onSaved } = input;
  const [shotDesign, setShotDesign] = useState<SceneShotVideoTakeDirection>(
    initial ?? emptyDirection()
  );

  const save = useCallback(
    (value: SceneShotVideoTakeDirection) => {
      if (!takeId) {
        return Promise.resolve(null);
      }
      return updateSceneShotVideoTakeDirection(
        projectName,
        sceneId,
        takeId,
        sceneShotVideoTakeDirectionHasState(value) ? value : null,
        shotId
      );
    },
    [projectName, sceneId, takeId, shotId]
  );

  const status = useDebouncedAutosave({
    value: shotDesign,
    save,
    failureMessage: 'Shot settings could not be saved.',
    flushOnUnmount: true,
    isReady: () => Boolean(takeId),
    onSaved: (result) => {
      if (result) {
        onSaved?.(result);
      }
    },
  });

  return { shotDesign, update: setShotDesign, status };
}

function emptyDirection(): SceneShotVideoTakeDirection {
  return {
    referenceSelections: {
      dependencyInclusions: {},
      selectedCharacterSheetAssetIds: {},
      referencedLocationSheetAssetIds: {},
      selectedLookbookSheetIds: [],
      selectedDialogueAudioTakeIds: {},
    },
  };
}
