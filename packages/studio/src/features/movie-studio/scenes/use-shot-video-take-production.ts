import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  ShotVideoTakeGenerationContext,
  ShotVideoTakeInputModeId,
  ShotVideoTakeModelChoice,
  ShotVideoTakeModelListReport,
  ShotVideoTakeParameterValue,
  ShotVideoTakeProductionEstimateReport,
  ShotVideoTakeProductionGroup,
  ShotVideoTakeProductionPlanReport,
} from '@gorenku/studio-core/client';
import {
  useDebouncedAutosave,
  type DebouncedAutosaveStatus,
} from '@/hooks/use-debounced-autosave';
import type { SceneShotListResourceResponse } from '@/services/studio-project-contracts';
import {
  defaultModelForInputMode,
  findModelReport,
} from './shot-video-take-production-projection';
import {
  clearShotVideoTakeInput,
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
  /** Ordered shot ids of the group to plan (the selected shot's group). */
  shotIds: string[];
  onResourceRefreshed?: (resource: SceneShotListResourceResponse) => void;
}

export interface UseShotVideoTakeProductionResult {
  loadState: 'loading' | 'ready' | 'error';
  loadError: string | null;
  context: ShotVideoTakeGenerationContext | null;
  models: ShotVideoTakeModelListReport | null;
  productionGroup: ShotVideoTakeProductionGroup | null;
  selectedInputMode: ShotVideoTakeInputModeId | null;
  selectedModel: ShotVideoTakeModelChoice | undefined;
  setInputMode: (inputMode: ShotVideoTakeInputModeId) => void;
  setModel: (model: ShotVideoTakeModelChoice) => void;
  setParameter: (name: string, value: ShotVideoTakeParameterValue) => void;
  autosave: DebouncedAutosaveStatus;
  productionPlan: ShotVideoTakeProductionPlanReport | null;
  estimate: ShotVideoTakeProductionEstimateReport | null;
  estimateState: 'idle' | 'loading' | 'error';
  estimateError: string | null;
  planState: 'idle' | 'loading' | 'error';
  planError: string | null;
  refreshProductionPlan: () => Promise<void>;
  reuseInput: (inputId: string) => Promise<void>;
  regenerateInput: (slot: ShotVideoTakeInputSlot) => Promise<void>;
}

function findGroupInResource(
  resource: SceneShotListResourceResponse,
  productionGroupId: string
): ShotVideoTakeProductionGroup | null {
  return (
    resource.activeShotList?.videoTakeProductionGroups?.find(
      (group) => group.productionGroupId === productionGroupId
    ) ?? null
  );
}

export function useShotVideoTakeProduction(
  input: UseShotVideoTakeProductionInput
): UseShotVideoTakeProductionResult {
  const { projectName, sceneId, onResourceRefreshed } = input;
  const shotIdsKey = input.shotIds.join(',');

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
  const [productionGroup, setProductionGroup] =
    useState<ShotVideoTakeProductionGroup | null>(null);
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
    const shotIds = shotIdsKey.split(',').filter((id) => id.length > 0);
    const load = async () => {
      setLoadState('loading');
      setLoadError(null);
      setProductionPlan(null);
      setEstimate(null);
      setEstimateState('idle');
      setEstimateError(null);
      if (shotIds.length === 0) {
        setContext(null);
        setModels(null);
        setProductionGroup(null);
        setLoadState('ready');
        return;
      }
      try {
        const read = await readShotVideoTakeProduction(
          projectName,
          sceneId,
          shotIds
        );
        if (cancelled) return;
        setContext(read.context);
        setModels(read.models);
        setProductionGroup(read.context.productionGroup);
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
  }, [projectName, sceneId, shotIdsKey]);

  const save = useCallback(
    (group: ShotVideoTakeProductionGroup) =>
      updateShotVideoTakeProduction(projectName, sceneId, group),
    [projectName, sceneId]
  );

  const autosave = useDebouncedAutosave({
    value: productionGroup,
    save: (group) => {
      if (!group) {
        return Promise.reject(new Error('No production group to save.'));
      }
      return save(group);
    },
    isReady: () => hasUserEditedRef.current && productionGroup !== null,
    onSaved: (result) => {
      onResourceRefreshed?.(result.resource);
    },
  });

  const editProduction = useCallback(
    (
      mutate: (
        group: ShotVideoTakeProductionGroup
      ) => ShotVideoTakeProductionGroup
    ) => {
      hasUserEditedRef.current = true;
      setProductionGroup((current) => (current ? mutate(current) : current));
    },
    []
  );

  const selectedInputMode = useMemo<ShotVideoTakeInputModeId | null>(() => {
    if (!productionGroup) return null;
    return (
      productionGroup.videoTakeProduction.inputModeId ??
      context?.defaults.inputModeId ??
      null
    );
  }, [context?.defaults.inputModeId, productionGroup]);
  const productionGroupShotIdsKey = productionGroup?.shotIds.join(',') ?? '';
  const storedModelChoice = productionGroup?.videoTakeProduction.modelChoice;

  const setInputMode = useCallback(
    (inputMode: ShotVideoTakeInputModeId) => {
      editProduction((group) => ({
        ...group,
        videoTakeProduction: {
          ...group.videoTakeProduction,
          inputModeId: inputMode,
        },
      }));
    },
    [editProduction]
  );

  useEffect(() => {
    if (!selectedInputMode || !productionGroupShotIdsKey) {
      return;
    }
    if (models?.inputModeId === selectedInputMode) {
      return;
    }
    let cancelled = false;
    const shotIds = productionGroupShotIdsKey
      .split(',')
      .filter((shotId) => shotId.length > 0);
    const loadModels = async () => {
      try {
        const read = await readShotVideoTakeProduction(
          projectName,
          sceneId,
          shotIds,
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
            videoTakeProduction: {
              ...group.videoTakeProduction,
              modelChoice: nextModel,
            },
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
    productionGroupShotIdsKey,
    projectName,
    sceneId,
    selectedInputMode,
    storedModelChoice,
    models?.inputModeId,
  ]);

  const setModel = useCallback(
    (model: ShotVideoTakeModelChoice) => {
      editProduction((group) => ({
        ...group,
        videoTakeProduction: {
          ...group.videoTakeProduction,
          modelChoice: model,
        },
      }));
    },
    [editProduction]
  );

  const setParameter = useCallback(
    (name: string, value: ShotVideoTakeParameterValue) => {
      editProduction((group) => ({
        ...group,
        videoTakeProduction: {
          ...group.videoTakeProduction,
          parameterValues: {
            ...group.videoTakeProduction.parameterValues,
            [name]: value,
          },
        },
      }));
    },
    [editProduction]
  );

  useEffect(() => {
    if (!productionGroup) {
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
          productionGroup
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
  }, [projectName, sceneId, productionGroup]);

  const refreshProductionPlan = useCallback(async () => {
    if (!productionGroup) return;
    setPlanState('loading');
    setPlanError(null);
    try {
      const report = await planShotVideoTakeProduction(
        projectName,
        sceneId,
        productionGroup
      );
      setProductionPlan(report);
      setEstimate({
        target: report.target,
        productionGroup: report.productionGroup,
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
  }, [projectName, sceneId, productionGroup]);

  useEffect(() => {
    if (!productionGroup) {
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
          productionGroup
        );
        if (cancelled) {
          return;
        }
        setProductionPlan(report);
        setEstimate({
          target: report.target,
          productionGroup: report.productionGroup,
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
  }, [projectName, sceneId, productionGroup]);

  const applyMutationResult = useCallback(
    (resource: SceneShotListResourceResponse, productionGroupId: string) => {
      onResourceRefreshed?.(resource);
      const refreshed = findGroupInResource(resource, productionGroupId);
      if (refreshed) {
        // Reusing/regenerating a dependency is an explicit action; adopt the
        // refreshed group without re-arming autosave.
        hasUserEditedRef.current = false;
        setProductionGroup(refreshed);
      }
    },
    [onResourceRefreshed]
  );

  const reuseInput = useCallback(
    async (inputId: string) => {
      if (!productionGroup) return;
      const result = await selectShotVideoTakeInput(
        projectName,
        sceneId,
        productionGroup.shotIds,
        inputId
      );
      applyMutationResult(result.resource, productionGroup.productionGroupId);
      await refreshProductionPlan();
    },
    [applyMutationResult, productionGroup, projectName, refreshProductionPlan, sceneId]
  );

  const regenerateInput = useCallback(
    async (slot: ShotVideoTakeInputSlot) => {
      if (!productionGroup) return;
      const result = await clearShotVideoTakeInput(
        projectName,
        sceneId,
        productionGroup.shotIds,
        slot
      );
      applyMutationResult(result.resource, productionGroup.productionGroupId);
      await refreshProductionPlan();
    },
    [applyMutationResult, productionGroup, projectName, refreshProductionPlan, sceneId]
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
    productionGroup,
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
  };
}
