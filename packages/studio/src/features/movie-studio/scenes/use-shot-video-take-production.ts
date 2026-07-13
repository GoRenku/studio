import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  GenerationCostEstimateReport,
  ShotVideoTakeGenerationSetup,
  ShotVideoTakeInputModeId,
  ShotVideoTakeModelChoice,
  ShotVideoTakeModelReport,
  ShotVideoTakeParameterValue,
} from '@gorenku/studio-core/client';
import { selectShotVideoTakeGenerationModel } from '@gorenku/studio-core/client';
import {
  useDebouncedAutosave,
  type DebouncedSaveStatus,
} from '@/hooks/use-debounced-autosave';
import {
  matchesSceneTakesResource,
  useStudioResourceRefresh,
} from '@/hooks/use-studio-resource-refresh';
import {
  estimateShotVideoTakeGeneration,
  readShotVideoTakeWorkspace,
  setShotVideoTakeGenerationReference,
  setShotVideoTakeGenerationSpec,
  type ShotVideoTakeWorkspaceMutation,
  type ShotVideoTakeWorkspaceResponse,
} from '@/services/studio-shot-video-takes-api';
import {
  defaultModelForInputMode,
  modelForInputMode,
} from './shot-video-take-production-projection';

export interface UseShotVideoTakeProductionInput {
  projectName: string;
  sceneId: string;
  takeId?: string | null;
  selectedShotId?: string;
  autosaveDelayMs?: number;
  onMutationSaved?: (result: ShotVideoTakeWorkspaceMutation) => void;
}

export interface UseShotVideoTakeProductionResult {
  loadState: 'loading' | 'ready' | 'error';
  loadError: string | null;
  workspace: ShotVideoTakeWorkspaceResponse | null;
  models: ShotVideoTakeModelReport[] | null;
  take: ShotVideoTakeWorkspaceResponse['take'] | null;
  isEditable: boolean;
  selectedInputMode: ShotVideoTakeInputModeId | null;
  selectedModel: ShotVideoTakeModelChoice | undefined;
  setup: ShotVideoTakeGenerationSetup | null;
  setInputMode: (inputMode: ShotVideoTakeInputModeId) => void;
  setModel: (model: ShotVideoTakeModelChoice) => void;
  setParameter: (name: string, value: ShotVideoTakeParameterValue) => void;
  autosave: DebouncedSaveStatus;
  estimate: GenerationCostEstimateReport | null;
  estimateState: 'idle' | 'loading' | 'error';
  estimateError: string | null;
  refreshWorkspace: () => Promise<void>;
  setReferenceIncluded: (selectionId: string, included: boolean) => Promise<void>;
}

export function useShotVideoTakeProduction(
  input: UseShotVideoTakeProductionInput
): UseShotVideoTakeProductionResult {
  const {
    projectName,
    sceneId,
    takeId,
    selectedShotId,
    autosaveDelayMs,
    onMutationSaved,
  } = input;
  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>('loading');
  const [loadError, setLoadError] = useState<string | null>(null);
  const [workspace, setWorkspace] = useState<ShotVideoTakeWorkspaceResponse | null>(null);
  const [setup, setSetup] = useState<ShotVideoTakeGenerationSetup | null>(null);
  const [estimate, setEstimate] = useState<GenerationCostEstimateReport | null>(null);
  const [estimateState, setEstimateState] = useState<'idle' | 'loading' | 'error'>('idle');
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const edited = useRef(false);
  const requestRevision = useRef(0);

  const applyWorkspace = useCallback((next: ShotVideoTakeWorkspaceResponse) => {
    setWorkspace(next);
    setSetup(next.generation.setup);
    setLoadState('ready');
    setLoadError(null);
  }, []);

  const refreshWorkspace = useCallback(async () => {
    if (!takeId) return;
    const revision = ++requestRevision.current;
    try {
      const next = selectedShotId
        ? await readShotVideoTakeWorkspace(
            projectName,
            sceneId,
            takeId,
            selectedShotId
          )
        : await readShotVideoTakeWorkspace(projectName, sceneId, takeId);
      if (requestRevision.current === revision) applyWorkspace(next);
    } catch (error) {
      if (requestRevision.current !== revision) return;
      setLoadState('error');
      setLoadError(error instanceof Error ? error.message : 'Unable to load AI Production.');
    }
  }, [applyWorkspace, projectName, sceneId, selectedShotId, takeId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      edited.current = false;
      setEstimate(null);
      setEstimateError(null);
      if (!takeId) {
        setWorkspace(null);
        setSetup(null);
        setLoadState('ready');
        return;
      }
      setLoadState('loading');
      void refreshWorkspace();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [refreshWorkspace, takeId]);

  const autosave = useDebouncedAutosave({
    value: setup,
    save: (value) => {
      if (!takeId || !value) return Promise.reject(new Error('No take generation setup to save.'));
      return selectedShotId
        ? setShotVideoTakeGenerationSpec(
            projectName,
            sceneId,
            takeId,
            value,
            selectedShotId
          )
        : setShotVideoTakeGenerationSpec(projectName, sceneId, takeId, value);
    },
    delayMs: autosaveDelayMs,
    failureMessage: 'AI Production settings could not be saved.',
    flushOnUnmount: true,
    isReady: () => edited.current && Boolean(takeId && setup && workspace?.take.status.editability.state === 'editable'),
    onSaved: (result) => {
      edited.current = false;
      applyWorkspace(result.workspace);
      onMutationSaved?.(result);
    },
  });

  const editSetup = useCallback(
    (update: (current: ShotVideoTakeGenerationSetup) => ShotVideoTakeGenerationSetup) => {
      edited.current = true;
      setSetup((current) => current ? update(current) : current);
    },
    []
  );

  const models = workspace?.generation.models ?? null;
  const selectedInputMode = setup?.inputModeId ?? null;
  const selectedModel = setup?.modelChoice ?? (
    models && selectedInputMode
      ? defaultModelForInputMode(models, selectedInputMode)
      : undefined
  );

  const setInputMode = useCallback((inputModeId: ShotVideoTakeInputModeId) => {
    editSetup((current) => {
      const next = { ...current, inputModeId };
      const modelChoice = models
        ? modelForInputMode(models, current.modelChoice, inputModeId)
        : undefined;
      const model = models?.find((candidate) => candidate.modelChoice === modelChoice);
      return model
        ? selectShotVideoTakeGenerationModel(next, model)
        : { ...next, ...(modelChoice ? { modelChoice } : {}) };
    });
  }, [editSetup, models]);

  const setModel = useCallback((modelChoice: ShotVideoTakeModelChoice) => {
    editSetup((current) => {
      const model = models?.find((candidate) => candidate.modelChoice === modelChoice);
      return model
        ? selectShotVideoTakeGenerationModel(current, model)
        : { ...current, modelChoice };
    });
  }, [editSetup, models]);

  const setParameter = useCallback((name: string, value: ShotVideoTakeParameterValue) => {
    editSetup((current) => ({
      ...current,
      parameterValues: { ...current.parameterValues, [name]: value },
    }));
  }, [editSetup]);

  useEffect(() => {
    if (!takeId || !setup || !selectedModel) return;
    const revision = ++requestRevision.current;
    const timer = window.setTimeout(() => {
      setEstimateState('loading');
      setEstimateError(null);
      void estimateShotVideoTakeGeneration(projectName, sceneId, takeId, {
        ...setup,
        modelChoice: selectedModel,
      }).then((report) => {
        if (requestRevision.current !== revision) return;
        setEstimate(report);
        setEstimateState('idle');
      }).catch((error) => {
        if (requestRevision.current !== revision) return;
        setEstimate(null);
        setEstimateState('error');
        setEstimateError(error instanceof Error ? error.message : 'Unable to estimate setup.');
      });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [projectName, sceneId, selectedModel, setup, takeId]);

  const setReferenceIncluded = useCallback(async (
    selectionId: string,
    included: boolean
  ) => {
    if (!takeId || workspace?.take.status.editability.state !== 'editable') return;
    const result = await setShotVideoTakeGenerationReference(
      projectName,
      sceneId,
      takeId,
      { selectionId, included, ...(selectedShotId ? { selectedShotId } : {}) }
    );
    applyWorkspace(result.workspace);
    onMutationSaved?.(result);
  }, [applyWorkspace, onMutationSaved, projectName, sceneId, selectedShotId, takeId, workspace?.take.status.editability.state]);

  useStudioResourceRefresh({
    projectName,
    enabled: Boolean(takeId),
    matches: (resourceKeys) => takeId
      ? matchesSceneTakesResource({ resourceKeys, sceneId, takeId })
      : false,
    onRefresh: refreshWorkspace,
  });

  return useMemo(() => ({
    loadState,
    loadError,
    workspace,
    models,
    take: workspace?.take ?? null,
    isEditable: workspace?.take.status.editability.state === 'editable',
    selectedInputMode,
    selectedModel,
    setup,
    setInputMode,
    setModel,
    setParameter,
    autosave,
    estimate,
    estimateState,
    estimateError,
    refreshWorkspace,
    setReferenceIncluded,
  }), [
    autosave,
    estimate,
    estimateError,
    estimateState,
    loadError,
    loadState,
    models,
    refreshWorkspace,
    selectedInputMode,
    selectedModel,
    setInputMode,
    setModel,
    setParameter,
    setReferenceIncluded,
    setup,
    workspace,
  ]);
}
