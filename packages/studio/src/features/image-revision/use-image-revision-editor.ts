import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  GenerationPreviewConfigurationValue,
  ImageRevisionDraft,
  ImageRevisionMode,
  ImageRevisionTarget,
  GenerationPreviewResource,
  GenerationPreviewReferenceSlot,
  GenerationPreviewResourceReference,
} from '@gorenku/studio-core/client';
import {
  estimateImageRevisionDraft,
  readImageRevisionContext,
  runImageRevision,
  type StudioImageRevisionEditorContext,
} from '@/services/studio-image-revisions-api';
import {
  createGenerationPreviewDraft,
  changeGenerationPreviewReference,
  type GenerationPreviewDraft,
} from '@/features/generation-preview/generation-preview-draft';

export interface ImageRevisionEditorRequest {
  projectName: string;
  target: ImageRevisionTarget;
}

export function useImageRevisionEditor(
  request: ImageRevisionEditorRequest,
  onCompleted: () => void,
) {
  const [context, setContext] =
    useState<StudioImageRevisionEditorContext | null>(null);
  const [mode, setMode] = useState<ImageRevisionMode>('regenerate');
  const [draft, setDraft] = useState<ImageRevisionDraft | null>(null);
  const [preview, setPreview] = useState<GenerationPreviewResource | null>(null);
  const [estimatedUsd, setEstimatedUsd] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [estimatePending, setEstimatePending] = useState(false);
  const [runPending, setRunPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editorRevision, setEditorRevision] = useState(0);
  const loadRevision = useRef(0);
  const estimateRevision = useRef(0);

  useEffect(() => {
    loadRevision.current += 1;
    estimateRevision.current += 1;
    const revision = loadRevision.current;
    void readImageRevisionContext(request)
      .then((nextContext) => {
        if (loadRevision.current !== revision) return;
        setContext(nextContext);
        const nextMode =
          nextContext.regenerate.state === 'available' ? 'regenerate' : 'edit';
        const nextModeContext = nextContext[nextMode];
        if (nextModeContext.state !== 'available') return;
        setMode(nextMode);
        setDraft(nextModeContext.draft);
        setPreview(nextModeContext.preview);
        setEditorRevision((current) => current + 1);
      })
      .catch((nextError) => {
        if (loadRevision.current === revision) {
          setError(nextError instanceof Error ? nextError.message : String(nextError));
        }
      })
      .finally(() => {
        if (loadRevision.current === revision) setLoading(false);
      });
  }, [request]);

  const changeMode = (nextMode: ImageRevisionMode) => {
    if (!context || context[nextMode].state !== 'available' || runPending) return;
    const nextModeContext = context[nextMode];
    setMode(nextMode);
    setDraft(nextModeContext.draft);
    setPreview(nextModeContext.preview);
    setEstimatedUsd(null);
    setError(null);
    setEditorRevision((revision) => revision + 1);
  };

  useEffect(() => {
    if (!request || !draft || runPending) {
      return;
    }
    const revision = estimateRevision.current + 1;
    estimateRevision.current = revision;
    const timer = window.setTimeout(() => {
      setEstimatePending(true);
      setError(null);
      void estimateImageRevisionDraft({ ...request, draft })
        .then((report) => {
          if (estimateRevision.current !== revision) return;
          setPreview(report.preview);
          setEstimatedUsd(report.estimatedUsd);
        })
        .catch((nextError) => {
          if (estimateRevision.current === revision) {
            setError(nextError instanceof Error ? nextError.message : String(nextError));
          }
        })
        .finally(() => {
          if (estimateRevision.current === revision) setEstimatePending(false);
        });
    }, 450);
    return () => window.clearTimeout(timer);
  }, [request, draft, runPending]);

  const editorDraft = useMemo<GenerationPreviewDraft | null>(() => {
    if (!draft) return null;
    if (preview) {
      const next = createGenerationPreviewDraft(preview);
      next.promptDraft.authoredText = draft.authoredText;
      next.promptDraft.negativeText = draft.negativeText;
      next.modelFamilyId = draft.modelFamilyId;
      next.slotSelections = draft.slotSelections;
      return next;
    }
    return {
      promptDraft: {
        authoredText: draft.authoredText,
        ...(draft.negativeText !== undefined
          ? { negativeText: draft.negativeText }
          : {}),
      },
      modelFamilyId: draft.modelFamilyId,
      parameterValues: {},
      authoredParameterNames: [],
      slotSelections: [],
    };
  }, [draft, preview]);

  const controls = preview && preview.authoring.selectedModelFamilyId === draft?.modelFamilyId
    ? preview.authoring.controls
    : [];

  const updateDraft = (update: (current: ImageRevisionDraft) => ImageRevisionDraft) => {
    setDraft((current) => (current ? update(current) : current));
    setError(null);
  };

  const updateControl = (
    controlId: string,
    value: GenerationPreviewConfigurationValue,
  ) => {
    updateDraft((current) => ({
      ...current,
      generationControls: current.generationControls.some(
        (control) => control.controlId === controlId,
      )
        ? current.generationControls.map((control) =>
            control.controlId === controlId ? { ...control, value } : control,
          )
        : [...current.generationControls, { controlId, value }],
    }));
  };

  const chooseModel = (modelKey: string) => {
    const family = preview?.authoring.modelFamilies.find(
      (candidate) => candidate.familyId === modelKey,
    );
    if (!family) return;
    updateDraft((current) => ({
      ...current,
      modelFamilyId: family.familyId,
      generationControls: family.familyId === preview?.authoring.selectedModelFamilyId
        ? preview.authoring.controls
        .filter((control) => control.kind !== 'readonly' && control.recommended)
        .map((control) => ({
          controlId: control.controlId,
          value: control.value,
        }))
        : [],
    }));
  };

  const chooseReference = (
    slot: GenerationPreviewReferenceSlot,
    reference: GenerationPreviewResourceReference | null,
  ) => {
    if (!editorDraft || slot.locked) return;
    const next = changeGenerationPreviewReference(editorDraft, slot, reference);
    updateDraft((current) => ({
      ...current,
      slotSelections: next.slotSelections,
    }));
  };

  const run = async () => {
    if (!draft || runPending) return;
    estimateRevision.current += 1;
    setRunPending(true);
    setError(null);
    try {
      const report = await runImageRevision({ ...request, draft });
      window.dispatchEvent(
        new CustomEvent('renku:studio-resource-changed', {
          detail: {
            projectName: request.projectName,
            resourceKeys: report.resourceKeys,
          },
        }),
      );
      onCompleted();
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setRunPending(false);
    }
  };

  const modeContext = context?.[mode] ?? null;
  return {
    context,
    mode,
    modeContext,
    draft,
    editorDraft,
    preview,
    estimatedUsd,
    loading,
    estimatePending,
    runPending,
    error,
    editorRevision,
    controls,
    changeMode,
    updateAuthoredText: (authoredText: string) => {
      if (!authoredText.trim()) {
        estimateRevision.current += 1;
        setEstimatePending(false);
        setEstimatedUsd(null);
      }
      updateDraft((current) => ({ ...current, authoredText }));
    },
    updateNegativeText: (negativeText: string) =>
      updateDraft((current) => ({ ...current, negativeText })),
    updateControl,
    chooseModel,
    chooseReference,
    run,
  };
}
