import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ShotVideoTakeProductionContext,
  ShotVideoTakeInputModeId,
  ShotVideoTakeModelChoice,
  ShotVideoTakeModelListReport,
  ShotVideoTakeParameterValue,
  ShotVideoTakeProductionEstimateReport,
  SceneShotVideoTake,
  SceneShotVideoTakeProductionState,
  ShotVideoTakeProductionPlanReport,
} from '@gorenku/studio-core/client';
import {
  useDebouncedAutosave,
  type DebouncedSaveStatus,
} from '@/hooks/use-debounced-autosave';
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
  takeId?: string | null;
}

export interface UseShotVideoTakeProductionResult {
  loadState: 'loading' | 'ready' | 'error';
  loadError: string | null;
  context: ShotVideoTakeProductionContext | null;
  models: ShotVideoTakeModelListReport | null;
  take: SceneShotVideoTake | null;
  isEditable: boolean;
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
  const { projectName, sceneId, takeId } = input;
  const takeIdKey = takeId ?? '';

  const [loadState, setLoadState] = useState<'loading' | 'ready' | 'error'>(
    'loading'
  );
  const [loadError, setLoadError] = useState<string | null>(null);
  const [context, setContext] = useState<ShotVideoTakeProductionContext | null>(
    null
  );
  const [models, setModels] = useState<ShotVideoTakeModelListReport | null>(
    null
  );
  const [take, setTake] =
    useState<SceneShotVideoTake | null>(null);
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
  const isEditable = take?.status.editability.state === 'editable';

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
      if (!takeId) {
        setContext(null);
        setModels(null);
        setTake(null);
        setLoadState('ready');
        return;
      }
      try {
        const read = await readShotVideoTakeProduction(
          projectName,
          sceneId,
          takeId
        );
        if (cancelled) return;
        setContext(read.context);
        setModels(read.models);
        setTake(read.context.take);
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
  }, [projectName, sceneId, takeId, takeIdKey]);

  const save = useCallback(
    (production: SceneShotVideoTakeProductionState) => {
      if (!takeId) {
        return Promise.reject(new Error('No take to save.'));
      }
      return updateShotVideoTakeProduction(
        projectName,
        sceneId,
        takeId,
        production
      );
    },
    [projectName, sceneId, takeId]
  );

  const autosave = useDebouncedAutosave({
    value: take?.state.production ?? null,
    save: (production) => {
      if (!production) {
        return Promise.reject(new Error('No take production to save.'));
      }
      return save(production);
    },
    failureMessage: 'AI Production settings could not be saved.',
    flushOnUnmount: true,
    isReady: () =>
      hasUserEditedRef.current &&
      take !== null &&
      take.status.editability.state === 'editable',
    onSaved: (result) => {
      hasUserEditedRef.current = false;
      setContext(result.context);
      setTake(result.context.take);
    },
  });

  const editProduction = useCallback(
    (
      mutate: (
        production: SceneShotVideoTakeProductionState
      ) => SceneShotVideoTakeProductionState
    ) => {
      setTake((current) => {
        if (!current || current.status.editability.state !== 'editable') {
          return current;
        }
        hasUserEditedRef.current = true;
        return {
          ...current,
          state: {
            ...current.state,
            production: mutate(current.state.production),
          },
        };
      });
    },
    []
  );

  const selectedInputMode = useMemo<ShotVideoTakeInputModeId | null>(() => {
    if (!take) return null;
    return (
      take.state.production.inputModeId ??
      context?.defaults.inputModeId ??
      null
    );
  }, [context?.defaults.inputModeId, take]);
  const storedModelChoice = take?.state.production.modelChoice;

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
    if (!selectedInputMode || !takeId) {
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
          takeId,
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
        if (nextModel && nextModel !== storedModelChoice && isEditable) {
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
    takeId,
    isEditable,
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
    if (!take || !takeId) {
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
          takeId,
          take.state.production
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
  }, [projectName, sceneId, take, takeId]);

  const refreshProductionPlan = useCallback(async () => {
    if (!takeId) return;
    setPlanState('loading');
    setPlanError(null);
    try {
      const report = await planShotVideoTakeProduction(
        projectName,
        sceneId,
        takeId,
        take?.state.production
      );
      setProductionPlan(report);
      setEstimate({
        target: report.target,
        take: report.take,
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
  }, [projectName, sceneId, take, takeId]);

  useEffect(() => {
    if (!takeId) {
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
          takeId,
          take?.state.production
        );
        if (cancelled) {
          return;
        }
        setProductionPlan(report);
        setEstimate({
          target: report.target,
          take: report.take,
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
  }, [projectName, sceneId, take?.state.production, takeId]);

  const applyMutationResult = useCallback((result: { context: ShotVideoTakeProductionContext }) => {
    hasUserEditedRef.current = false;
    setContext(result.context);
    setTake(result.context.take);
  }, []);

  const reuseInput = useCallback(
    async (inputId: string) => {
      if (!takeId || !isEditable) return;
      const result = await selectShotVideoTakeInput(
        projectName,
        sceneId,
        takeId,
        inputId
      );
      applyMutationResult(result);
      await refreshProductionPlan();
    },
    [applyMutationResult, isEditable, projectName, refreshProductionPlan, sceneId, takeId]
  );

  const regenerateInput = useCallback(
    async (slot: ShotVideoTakeInputSlot) => {
      if (!takeId || !isEditable) return;
      const result = await clearShotVideoTakeInput(
        projectName,
        sceneId,
        takeId,
        slot
      );
      applyMutationResult(result);
      await refreshProductionPlan();
    },
    [applyMutationResult, isEditable, projectName, refreshProductionPlan, sceneId, takeId]
  );

  const deleteInput = useCallback(
    async (inputId: string) => {
      if (!takeId || !isEditable) return;
      const result = await deleteShotVideoTakeInput(
        projectName,
        sceneId,
        takeId,
        inputId
      );
      applyMutationResult(result);
      await refreshProductionPlan();
    },
    [applyMutationResult, isEditable, projectName, refreshProductionPlan, sceneId, takeId]
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
    take,
    isEditable,
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
