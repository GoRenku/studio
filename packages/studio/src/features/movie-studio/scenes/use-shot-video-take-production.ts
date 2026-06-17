import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ShotVideoTakeGenerationContext,
  ShotVideoTakeInputModeId,
  ShotVideoTakeModelChoice,
  ShotVideoTakeModelListReport,
  ShotVideoTakeParameterValue,
  ShotVideoTakeProductionEstimateReport,
  SceneShotVideoTakeGeneration,
  ShotVideoTakeGenerationProduction,
  ShotVideoTakeProductionPlanReport,
} from '@gorenku/studio-core/client';
import {
  useDebouncedAutosave,
  type DebouncedSaveStatus,
} from '@/hooks/use-debounced-autosave';
import type { SceneShotListResourceResponse } from '@/services/studio-project-contracts';
import {
  defaultModelForInputMode,
  findModelReport,
} from './shot-video-take-production-projection';
import {
  clearShotVideoTakeInput,
  deleteShotVideoTakeInput,
  estimateShotVideoTakeProduction,
  planShotVideoTakeProduction,
  readShotVideoTakeProduction,
  selectShotVideoTakeInput,
  updateShotVideoTakeProduction,
  type ShotVideoTakeInputSlot,
} from '@/services/studio-shot-video-takes-api';

export interface UseShotVideoTakeProductionInput {
  projectName: string;
  sceneId: string;
  takeGenerationId?: string | null;
  onResourceRefreshed?: (resource: SceneShotListResourceResponse) => void;
}

export interface UseShotVideoTakeProductionResult {
  loadState: 'loading' | 'ready' | 'error';
  loadError: string | null;
  context: ShotVideoTakeGenerationContext | null;
  models: ShotVideoTakeModelListReport | null;
  takeGeneration: SceneShotVideoTakeGeneration | null;
  selectedInputMode: ShotVideoTakeInputModeId | null;
  selectedModel: ShotVideoTakeModelChoice | undefined;
  setInputMode: (inputMode: ShotVideoTakeInputModeId) => void;
  setModel: (model: ShotVideoTakeModelChoice) => void;
  setParameter: (name: string, value: ShotVideoTakeParameterValue) => void;
  autosave: DebouncedSaveStatus;
  productionPlan: ShotVideoTakeProductionPlanReport | null;
  estimate: ShotVideoTakeProductionEstimateReport | null;
  estimateState: 'idle' | 'loading' | 'error';
  estimateError: string | null;
  planState: 'idle' | 'loading' | 'error';
  planError: string | null;
  refreshProductionPlan: () => Promise<void>;
  reuseInput: (inputId: string) => Promise<void>;
  regenerateInput: (slot: ShotVideoTakeInputSlot) => Promise<void>;
  deleteInput: (inputId: string) => Promise<void>;
}

export function useShotVideoTakeProduction(
  input: UseShotVideoTakeProductionInput
): UseShotVideoTakeProductionResult {
  const { projectName, sceneId, takeGenerationId, onResourceRefreshed } = input;
  const takeGenerationIdKey = takeGenerationId ?? '';

  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>(
    'loading'
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [context, setContext] = useState<ShotVideoTakeGenerationContext | null>(
    null
  );
  const [models, setModels] = useState<ShotVideoTakeModelListReport | null>(
    null
  );
  const [takeGeneration, setTakeGeneration] =
    useState<SceneShotVideoTakeGeneration | null>(null);
  const [productionPlan, setProductionPlan] =
    useState<ShotVideoTakeProductionPlanReport | null>(null);
  const [estimate, setEstimate] =
    useState<ShotVideoTakeProductionEstimateReport | null>(null);
  const [estimateState, setEstimateState] = useState<
    'idle' | 'loading' | 'error'
  >('idle');
  const [estimateError, setEstimateError] = useState<string | null>(null);
  const [planState, setPlanState] = useState<'idle' | 'loading' | 'error'>(
    'idle'
  );
  const [planError, setPlanError] = useState<string | null>(null);

  // Autosave only starts after the user edits a value, so loading the group
  // never triggers a spurious save.
  const hasUserEditedRef = useRef(false);

  useEffect(() => {
    let cancelled = false;
    hasUserEditedRef.current = false;
    const load = async () => {
      setLoadState('loading');
      setLoadError(null);
      setProductionPlan(null);
      setEstimate(null);
      setEstimateState('idle');
      setEstimateError(null);
      if (!takeGenerationId) {
        setContext(null);
        setModels(null);
        setTakeGeneration(null);
        setLoadState('ready');
        return;
      }
      try {
        const read = await readShotVideoTakeProduction(
          projectName,
          sceneId,
          takeGenerationId
        );
        if (cancelled) return;
        setContext(read.context);
        setModels(read.models);
        setTakeGeneration(read.context.takeGeneration);
        setLoadState('ready');
      } catch (error) {
        if (cancelled) return;
        setLoadError(
          error instanceof Error ? error.message : 'Unable to load AI Production.'
        );
        setLoadState('error');
      }
    };
    void load();
    return () => {
      cancelled = true;
    };
  }, [projectName, sceneId, takeGenerationId, takeGenerationIdKey]);

  const save = useCallback(
    (production: ShotVideoTakeGenerationProduction) => {
      if (!takeGenerationId) {
        return Promise.reject(new Error('No take generation to save.'));
      }
      return updateShotVideoTakeProduction(
        projectName,
        sceneId,
        takeGenerationId,
        production
      );
    },
    [projectName, sceneId, takeGenerationId]
  );

  const autosave = useDebouncedAutosave({
    value: takeGeneration?.production ?? null,
    save: (production) => {
      if (!production) {
        return Promise.reject(new Error('No take generation production to save.'));
      }
      return save(production);
    },
    failureMessage: 'AI Production settings could not be saved.',
    isReady: () => hasUserEditedRef.current && takeGeneration !== null,
    onSaved: (result) => {
      hasUserEditedRef.current = false;
      setContext(result.context);
      setTakeGeneration(result.context.takeGeneration);
      void onResourceRefreshed;
    },
  });

  const editProduction = useCallback(
    (
      mutate: (
        production: ShotVideoTakeGenerationProduction
      ) => ShotVideoTakeGenerationProduction
    ) => {
      hasUserEditedRef.current = true;
      setTakeGeneration((current) =>
        current ? { ...current, production: mutate(current.production) } : current
      );
    },
    []
  );

  const selectedInputMode = useMemo<ShotVideoTakeInputModeId | null>(() => {
    if (!takeGeneration) return null;
    return (
      takeGeneration.production.inputModeId ??
      context?.defaults.inputModeId ??
      null
    );
  }, [context?.defaults.inputModeId, takeGeneration]);
  const storedModelChoice = takeGeneration?.production.modelChoice;

  const setInputMode = useCallback(
    (inputMode: ShotVideoTakeInputModeId) => {
      editProduction((group) => ({
        ...group,
        inputModeId: inputMode,
      }));
    },
    [editProduction]
  );

  useEffect(() => {
    if (!selectedInputMode || !takeGenerationId) {
      return;
    }
    if (models?.inputModeId === selectedInputMode) {
      return;
    }
    let cancelled = false;
    const loadModels = async () => {
      try {
        const read = await readShotVideoTakeProduction(
          projectName,
          sceneId,
          takeGenerationId,
          selectedInputMode
        );
        if (cancelled) {
          return;
        }
        setModels(read.models);
        if (!storedModelChoice) {
          return;
        }
        const currentReport = findModelReport(read.models, storedModelChoice);
        if (
          currentReport?.available &&
          currentReport.supportedInputModes.includes(selectedInputMode)
        ) {
          return;
        }
        const nextModel = defaultModelForInputMode(read.models, selectedInputMode);
        if (nextModel && nextModel !== storedModelChoice) {
          editProduction((group) => ({
            ...group,
            modelChoice: nextModel,
          }));
        }
      } catch (error) {
        if (cancelled) {
          return;
        }
        setLoadError(
          error instanceof Error ? error.message : 'Unable to load AI Production.'
        );
        setLoadState('error');
      }
    };
    void loadModels();
    return () => {
      cancelled = true;
    };
  }, [
    editProduction,
    projectName,
    sceneId,
    selectedInputMode,
    storedModelChoice,
    models?.inputModeId,
    takeGenerationId,
  ]);

  const setModel = useCallback(
    (model: ShotVideoTakeModelChoice) => {
      editProduction((group) => ({
        ...group,
        modelChoice: model,
      }));
    },
    [editProduction]
  );

  const setParameter = useCallback(
    (name: string, value: ShotVideoTakeParameterValue) => {
      editProduction((group) => ({
        ...group,
        parameterValues: {
          ...group.parameterValues,
          [name]: value,
        },
      }));
    },
    [editProduction]
  );

  useEffect(() => {
    if (!takeGeneration || !takeGenerationId) {
      return;
    }
    let cancelled = false;
    const loadEstimate = async () => {
      setEstimateState('loading');
      setEstimateError(null);
      try {
        const report = await estimateShotVideoTakeProduction(
          projectName,
          sceneId,
          takeGenerationId,
          takeGeneration.production
        );
        if (cancelled) {
          return;
        }
        setEstimate(report);
        setEstimateState('idle');
      } catch (error) {
        if (cancelled) {
          return;
        }
        setEstimate(null);
        setEstimateError(
          error instanceof Error ? error.message : 'Unable to estimate setup.'
        );
        setEstimateState('error');
      }
    };
    void loadEstimate();
    return () => {
      cancelled = true;
    };
  }, [projectName, sceneId, takeGeneration, takeGenerationId]);

  const refreshProductionPlan = useCallback(async () => {
    if (!takeGenerationId) return;
    setPlanState('loading');
    setPlanError(null);
    try {
      const report = await planShotVideoTakeProduction(
        projectName,
        sceneId,
        takeGenerationId,
        takeGeneration?.production
      );
      setProductionPlan(report);
      setEstimate({
        target: report.target,
        takeGeneration: report.takeGeneration,
        inputModeId: report.plan.request.inputMode,
        shotGroupMode: report.plan.request.shotGroupMode,
        modelChoice: report.plan.request.modelChoice,
        estimate: report.plan.finalEstimate,
        plan: report.plan,
        issues: report.plan.diagnostics,
      });
      setEstimateState('idle');
      setEstimateError(null);
      setPlanState('idle');
    } catch (error) {
      setPlanError(
        error instanceof Error ? error.message : 'Unable to build take plan.'
      );
      setPlanState('error');
    }
  }, [projectName, sceneId, takeGeneration, takeGenerationId]);

  useEffect(() => {
    if (!takeGenerationId) {
      return;
    }
    let cancelled = false;
    const loadPlan = async () => {
      setPlanState('loading');
      setPlanError(null);
      try {
        const report = await planShotVideoTakeProduction(
          projectName,
          sceneId,
          takeGenerationId,
          takeGeneration?.production
        );
        if (cancelled) {
          return;
        }
        setProductionPlan(report);
        setEstimate({
          target: report.target,
          takeGeneration: report.takeGeneration,
          inputModeId: report.plan.request.inputMode,
          shotGroupMode: report.plan.request.shotGroupMode,
          modelChoice: report.plan.request.modelChoice,
          estimate: report.plan.finalEstimate,
          plan: report.plan,
          issues: report.plan.diagnostics,
        });
        setEstimateState('idle');
        setEstimateError(null);
        setPlanState('idle');
      } catch (error) {
        if (cancelled) {
          return;
        }
        setPlanError(
          error instanceof Error ? error.message : 'Unable to build take plan.'
        );
        setPlanState('error');
      }
    };
    void loadPlan();
    return () => {
      cancelled = true;
    };
  }, [projectName, sceneId, takeGeneration?.production, takeGenerationId]);

  const applyMutationResult = useCallback((result: { context: ShotVideoTakeGenerationContext }) => {
    hasUserEditedRef.current = false;
    setContext(result.context);
    setTakeGeneration(result.context.takeGeneration);
  }, []);

  const reuseInput = useCallback(
    async (inputId: string) => {
      if (!takeGenerationId) return;
      const result = await selectShotVideoTakeInput(
        projectName,
        sceneId,
        takeGenerationId,
        inputId
      );
      applyMutationResult(result);
      await refreshProductionPlan();
    },
    [applyMutationResult, projectName, refreshProductionPlan, sceneId, takeGenerationId]
  );

  const regenerateInput = useCallback(
    async (slot: ShotVideoTakeInputSlot) => {
      if (!takeGenerationId) return;
      const result = await clearShotVideoTakeInput(
        projectName,
        sceneId,
        takeGenerationId,
        slot
      );
      applyMutationResult(result);
      await refreshProductionPlan();
    },
    [applyMutationResult, projectName, refreshProductionPlan, sceneId, takeGenerationId]
  );

  const deleteInput = useCallback(
    async (inputId: string) => {
      if (!takeGenerationId) return;
      const result = await deleteShotVideoTakeInput(
        projectName,
        sceneId,
        takeGenerationId,
        inputId
      );
      applyMutationResult(result);
      await refreshProductionPlan();
    },
    [applyMutationResult, projectName, refreshProductionPlan, sceneId, takeGenerationId]
  );

  const selectedModel =
    storedModelChoice ??
    (models && selectedInputMode
      ? defaultModelForInputMode(models, selectedInputMode)
      : undefined);

  return {
    loadState,
    loadError,
    context,
    models,
    takeGeneration,
    selectedInputMode,
    selectedModel,
    setInputMode,
    setModel,
    setParameter,
    autosave,
    productionPlan,
    estimate,
    estimateState,
    estimateError,
    planState,
    planError,
    refreshProductionPlan,
    reuseInput,
    regenerateInput,
    deleteInput,
  };
}
