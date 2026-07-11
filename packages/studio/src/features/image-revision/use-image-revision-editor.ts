import { useEffect, useMemo, useRef, useState } from 'react';
import type {
  GenerationPreviewConfigurationValue,
  ImageRevisionDraft,
  ImageRevisionMode,
  ImageRevisionTarget,
  StudioGenerationPreview,
  StudioGenerationPreviewReference,
} from '@gorenku/studio-core/client';
import {
  estimateImageRevisionDraft,
  readImageRevisionContext,
  runImageRevision,
  type StudioImageRevisionEditorContext,
} from '@/services/studio-image-revisions-api';
import {
  createGenerationPreviewDraft,
  generationPreviewReferenceSelected,
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
  const [preview, setPreview] = useState<StudioGenerationPreview | null>(null);
  const [estimatedUsd, setEstimatedUsd] = useState<number | null>(null);
  const [loading, setLoading] = useState(true);
  const [estimatePending, setEstimatePending] = useState(false);
  const [runPending, setRunPending] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [editorRevision, setEditorRevision] = useState(0);
  const requestRevision = useRef(0);

  useEffect(() => {
    requestRevision.current += 1;
    const revision = requestRevision.current;
    void readImageRevisionContext(request)
      .then((nextContext) => {
        if (requestRevision.current !== revision) return;
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
        if (requestRevision.current === revision) {
          setError(nextError instanceof Error ? nextError.message : String(nextError));
        }
      })
      .finally(() => {
        if (requestRevision.current === revision) setLoading(false);
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
    if (!request || !draft || !draft.authoredText.trim() || runPending) {
      return;
    }
    const revision = requestRevision.current + 1;
    requestRevision.current = revision;
    const timer = window.setTimeout(() => {
      setEstimatePending(true);
      setError(null);
      void estimateImageRevisionDraft({ ...request, draft })
        .then((report) => {
          if (requestRevision.current !== revision) return;
          setPreview(report.preview);
          setEstimatedUsd(report.estimatedUsd);
        })
        .catch((nextError) => {
          if (requestRevision.current === revision) {
            setError(nextError instanceof Error ? nextError.message : String(nextError));
          }
        })
        .finally(() => {
          if (requestRevision.current === revision) setEstimatePending(false);
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
      next.referenceSelectionDraftByDependencyId = Object.fromEntries(
        draft.referenceSelections.map((selection) => [
          selection.dependencyId,
          selection.selected,
        ]),
      );
      return next;
    }
    return {
      promptDraft: {
        authoredText: draft.authoredText,
        ...(draft.negativeText !== undefined
          ? { negativeText: draft.negativeText }
          : {}),
      },
      referenceSelectionDraftByDependencyId: Object.fromEntries(
        draft.referenceSelections.map((selection) => [
          selection.dependencyId,
          selection.selected,
        ]),
      ),
    };
  }, [draft, preview]);

  const updateDraft = (update: (current: ImageRevisionDraft) => ImageRevisionDraft) => {
    setDraft((current) => (current ? update(current) : current));
    setError(null);
  };

  const toggleReference = (reference: StudioGenerationPreviewReference) => {
    if (!draft || !editorDraft || !reference.selectionControl?.editable) return;
    const selected = generationPreviewReferenceSelected(reference, editorDraft);
    updateDraft((current) => ({
      ...current,
      referenceSelections: current.referenceSelections.map((selection) =>
        selection.dependencyId === reference.selectionControl?.dependencyId
          ? { ...selection, selected: !selected }
          : selection,
      ),
    }));
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

  const run = async () => {
    if (!draft || !draft.authoredText.trim() || runPending) return;
    requestRevision.current += 1;
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
    changeMode,
    updateAuthoredText: (authoredText: string) => {
      if (!authoredText.trim()) {
        requestRevision.current += 1;
        setEstimatePending(false);
        setEstimatedUsd(null);
        if (mode === 'edit') setPreview(null);
      }
      updateDraft((current) => ({ ...current, authoredText }));
    },
    updateNegativeText: (negativeText: string) =>
      updateDraft((current) => ({ ...current, negativeText })),
    toggleReference,
    updateControl,
    run,
  };
}
