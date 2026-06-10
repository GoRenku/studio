import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type {
  SceneDialogueAudioGenerationSpec,
  SceneDialogueAudioModelChoice,
  SceneDialogueAudioVoiceSettings,
} from '@gorenku/studio-core/client';
import {
  estimateSceneDialogueAudioDraft,
  generateSceneDialogueAudioTake,
  pickSceneDialogueAudioTake,
  deleteSceneDialogueAudioTake,
  saveSceneDialogueAudioSetup,
  type SceneDialogueAudioContextWithUrls,
} from '@/services/studio-scene-dialogue-audio-api';
import { useDebouncedAutosave } from '@/hooks/use-debounced-autosave';

export interface SceneDialogueAudioDraft {
  modelChoice: SceneDialogueAudioModelChoice;
  castVoiceId: string;
  plainText: string;
  v3Text: string;
  voiceSettings: SceneDialogueAudioVoiceSettings;
  outputFormat: string;
  languageCode: string | null;
}

export interface SceneDialogueAudioEstimateState {
  state: 'idle' | 'loading' | 'ready' | 'error';
  label: string;
  message: string | null;
}

export interface SceneDialogueAudioPlayer {
  playingUrl: string | null;
  progressByUrl: Record<string, number>;
  durationByUrl: Record<string, number>;
  toggle: (url: string) => void;
  seek: (url: string, seconds: number) => void;
}

const idleEstimate: SceneDialogueAudioEstimateState = {
  state: 'idle',
  label: 'Calculating...',
  message: null,
};

export function useSceneDialogueAudio(input: {
  projectName: string;
  sceneId: string;
  dialogueId: string;
  context: SceneDialogueAudioContextWithUrls;
  onDraftTextPreviewChange?: (text: string | null) => void;
  onContextChange: (context: SceneDialogueAudioContextWithUrls) => void;
}) {
  const {
    projectName,
    sceneId,
    dialogueId,
    context,
    onDraftTextPreviewChange,
    onContextChange,
  } = input;
  const dialogue = context.dialogues.find(
    (candidate) => candidate.dialogueId === dialogueId
  );
  const existing = context.audioByDialogueId[dialogueId] ?? null;
  const voices = dialogue?.castMemberId
    ? context.castVoicesByCastMemberId[dialogue.castMemberId] ?? []
    : [];
  const usableVoices = voices.filter((voice) => voice.usable);

  const initialDraft = useMemo<SceneDialogueAudioDraft>(() => {
    const modelChoice = existing?.modelChoice ?? context.defaults.modelChoice;
    const selectedModel =
      context.models.find((model) => model.modelChoice === modelChoice) ??
      context.models[0];
    const defaultVoiceSettings =
      selectedModel?.defaultVoiceSettings ?? context.defaults.voiceSettings;
    return {
      modelChoice,
      castVoiceId: existing?.castVoiceId ?? usableVoices[0]?.id ?? '',
      plainText: existing?.plainText ?? dialogue?.plainText ?? '',
      v3Text: existing?.v3Text ?? dialogue?.plainText ?? '',
      voiceSettings: {
        ...defaultVoiceSettings,
        ...(existing?.voiceSettings ?? {}),
      },
      outputFormat:
        existing?.outputFormat ??
        selectedModel?.outputFormats[0] ??
        context.defaults.outputFormat,
      languageCode: existing?.languageCode ?? context.defaults.languageCode,
    };
  }, [
    context.defaults.languageCode,
    context.defaults.modelChoice,
    context.defaults.outputFormat,
    context.defaults.voiceSettings,
    context.models,
    dialogue?.plainText,
    existing?.castVoiceId,
    existing?.languageCode,
    existing?.modelChoice,
    existing?.outputFormat,
    existing?.plainText,
    existing?.v3Text,
    existing?.voiceSettings,
    usableVoices,
  ]);

  const [draft, setDraft] = useState<SceneDialogueAudioDraft>(initialDraft);
  const [estimateState, setEstimateState] = useState<{
    specSignature: string;
    estimate: SceneDialogueAudioEstimateState;
  }>({ specSignature: '', estimate: idleEstimate });
  const [approval, setApproval] = useState<{
    specSignature: string;
    token: string;
  } | null>(null);
  const [actionBusy, setActionBusy] = useState(false);

  const selectedModel = useMemo(
    () =>
      context.models.find((model) => model.modelChoice === draft.modelChoice) ??
      context.models[0],
    [context.models, draft.modelChoice]
  );
  const selectedVoice = useMemo(
    () => usableVoices.find((voice) => voice.id === draft.castVoiceId) ?? null,
    [draft.castVoiceId, usableVoices]
  );
  const blockedIssue = !dialogue
    ? 'Dialogue was not found.'
    : !dialogue.castMemberId
      ? 'This dialogue has no Cast Member.'
      : usableVoices.length === 0
        ? 'This cast member is missing a usable ElevenLabs voice id.'
        : !draft.castVoiceId
          ? 'Choose a Cast Voice before generating.'
          : null;
  const blocked = Boolean(blockedIssue);
  const nonV3 = draft.modelChoice !== 'elevenlabs/eleven_v3';
  const takes = existing?.takes ?? [];

  const spec = useMemo<SceneDialogueAudioGenerationSpec>(
    () => ({
      purpose: 'scene.dialogue-audio',
      target: { kind: 'sceneDialogue', sceneId, dialogueId },
      modelChoice: draft.modelChoice,
      castVoiceId: draft.castVoiceId,
      plainText: draft.plainText,
      v3Text: draft.v3Text,
      voiceSettings: draft.voiceSettings,
      outputFormat: draft.outputFormat,
      languageCode: draft.languageCode,
    }),
    [dialogueId, draft, sceneId]
  );

  const specSignature = useMemo(() => JSON.stringify(spec), [spec]);
  const estimate = blocked
    ? {
        state: 'idle' as const,
        label: 'Unavailable',
        message: blockedIssue,
      }
    : estimateState.specSignature === specSignature
      ? estimateState.estimate
      : idleEstimate;
  const approvalToken =
    approval?.specSignature === specSignature ? approval.token : null;

  const autosave = useDebouncedAutosave({
    value: spec,
    delayMs: 350,
    flushOnUnmount: true,
    failureMessage: 'Dialogue audio setup could not be saved.',
    isReady: () => !blocked,
    save: (nextSpec) =>
      saveSceneDialogueAudioSetup(projectName, sceneId, dialogueId, nextSpec),
    onSaved: (report) => {
      onContextChange(report.context);
      onDraftTextPreviewChange?.(null);
    },
  });

  const updateDraft = useCallback(
    (patch: Partial<SceneDialogueAudioDraft>) => {
      setDraft((current) => {
        const next = { ...current, ...patch };
        onDraftTextPreviewChange?.(dialogueTextPreview(next));
        return next;
      });
    },
    [onDraftTextPreviewChange]
  );

  const updateVoiceSettings = useCallback(
    (patch: Partial<SceneDialogueAudioVoiceSettings>) => {
      setDraft((current) => ({
        ...current,
        voiceSettings: { ...current.voiceSettings, ...patch },
      }));
    },
    []
  );

  const chooseModel = useCallback(
    (modelChoice: SceneDialogueAudioModelChoice) => {
      const nextModel =
        context.models.find((model) => model.modelChoice === modelChoice) ??
        selectedModel;
      setDraft((current) => {
        const next = {
          ...current,
          modelChoice,
          outputFormat: nextModel?.outputFormats.includes(current.outputFormat)
            ? current.outputFormat
            : nextModel?.outputFormats[0] ?? context.defaults.outputFormat,
          voiceSettings: {
            ...(nextModel?.defaultVoiceSettings ?? context.defaults.voiceSettings),
            ...current.voiceSettings,
          },
        };
        onDraftTextPreviewChange?.(dialogueTextPreview(next));
        return next;
      });
    },
    [
      context.defaults.outputFormat,
      context.defaults.voiceSettings,
      context.models,
      onDraftTextPreviewChange,
      selectedModel,
    ]
  );

  const resetAdvancedValues = useCallback(() => {
    setDraft((current) => ({
      ...current,
      voiceSettings:
        selectedModel?.defaultVoiceSettings ?? context.defaults.voiceSettings,
      outputFormat: selectedModel?.outputFormats[0] ?? context.defaults.outputFormat,
      languageCode: null,
    }));
  }, [
    context.defaults.outputFormat,
    context.defaults.voiceSettings,
    selectedModel,
  ]);

  useEffect(() => {
    if (blocked) {
      return;
    }

    let cancelled = false;

    void estimateSceneDialogueAudioDraft(
      projectName,
      sceneId,
      dialogueId,
      spec
    )
      .then((report) => {
        if (cancelled) {
          return;
        }
        setApproval(
          report.estimate.approvalToken
            ? { specSignature, token: report.estimate.approvalToken }
            : null
        );
        setEstimateState({
          specSignature,
          estimate: {
            state: 'ready',
            label:
              report.estimate.estimatedCostUsd === null
                ? 'Unpriced'
                : `$${report.estimate.estimatedCostUsd.toFixed(4)}`,
            message: null,
          },
        });
      })
      .catch((error: unknown) => {
        if (cancelled) {
          return;
        }
        setApproval(null);
        setEstimateState({
          specSignature,
          estimate: {
            state: 'error',
            label: 'Unavailable',
            message:
              error instanceof Error
                ? error.message
                : 'Dialogue audio estimate failed.',
          },
        });
      });

    return () => {
      cancelled = true;
    };
  }, [
    blocked,
    dialogueId,
    projectName,
    sceneId,
    spec,
    specSignature,
  ]);

  const generateTake = useCallback(async () => {
    if (blocked) {
      throw new Error(blockedIssue ?? 'Dialogue audio cannot be generated.');
    }
    if (actionBusy) {
      return;
    }
    if (!approvalToken) {
      throw new Error('Wait for the current estimate before generating audio.');
    }
    setActionBusy(true);
    try {
      const report = await generateSceneDialogueAudioTake(
        projectName,
        sceneId,
        dialogueId,
        { setup: spec, approvalToken }
      );
      onContextChange(report.context);
      setApproval(null);
      setEstimateState({ specSignature, estimate: idleEstimate });
    } finally {
      setActionBusy(false);
    }
  }, [
    actionBusy,
    approvalToken,
    blocked,
    blockedIssue,
    dialogueId,
    onContextChange,
    projectName,
    sceneId,
    spec,
    specSignature,
  ]);

  const pickTake = useCallback(
    async (takeId: string) => {
      setActionBusy(true);
      try {
        const report = await pickSceneDialogueAudioTake(
          projectName,
          sceneId,
          dialogueId,
          takeId
        );
        onContextChange(report.context);
      } finally {
        setActionBusy(false);
      }
    },
    [dialogueId, onContextChange, projectName, sceneId]
  );

  const deleteTake = useCallback(
    async (takeId: string) => {
      setActionBusy(true);
      try {
        const report = await deleteSceneDialogueAudioTake(
          projectName,
          sceneId,
          dialogueId,
          takeId
        );
        onContextChange(report.context);
      } finally {
        setActionBusy(false);
      }
    },
    [dialogueId, onContextChange, projectName, sceneId]
  );

  return {
    actionBusy,
    approvalToken,
    autosave,
    blocked,
    blockedIssue,
    context,
    dialogue,
    draft,
    estimate,
    existing,
    nonV3,
    selectedModel,
    selectedVoice,
    spec,
    takes,
    usableVoices,
    chooseModel,
    deleteTake,
    generateTake,
    pickTake,
    resetAdvancedValues,
    updateDraft,
    updateVoiceSettings,
  };
}

function dialogueTextPreview(draft: SceneDialogueAudioDraft): string {
  return draft.modelChoice === 'elevenlabs/eleven_v3'
    ? draft.v3Text
    : draft.plainText;
}

export function useSceneDialogueAudioPlayer(): SceneDialogueAudioPlayer {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const [playingUrl, setPlayingUrl] = useState<string | null>(null);
  const [progressByUrl, setProgressByUrl] = useState<Record<string, number>>({});
  const [durationByUrl, setDurationByUrl] = useState<Record<string, number>>({});

  const stop = useCallback(() => {
    audioRef.current?.pause();
    audioRef.current = null;
    setPlayingUrl(null);
  }, []);

  const toggle = useCallback(
    (url: string) => {
      if (playingUrl === url) {
        stop();
        return;
      }

      audioRef.current?.pause();
      const audio = new Audio(url);
      audioRef.current = audio;
      setPlayingUrl(url);

      audio.addEventListener('loadedmetadata', () => {
        if (Number.isFinite(audio.duration)) {
          setDurationByUrl((current) => ({
            ...current,
            [url]: audio.duration,
          }));
        }
      });
      audio.addEventListener('timeupdate', () => {
        setProgressByUrl((current) => ({
          ...current,
          [url]: audio.currentTime,
        }));
      });
      audio.addEventListener('ended', () => {
        setProgressByUrl((current) => ({ ...current, [url]: 0 }));
        setPlayingUrl(null);
        audioRef.current = null;
      });
      void audio.play().catch(() => {
        setPlayingUrl(null);
        audioRef.current = null;
      });
    },
    [playingUrl, stop]
  );

  const seek = useCallback((url: string, seconds: number) => {
    if (audioRef.current && playingUrl === url) {
      audioRef.current.currentTime = seconds;
    }
    setProgressByUrl((current) => ({ ...current, [url]: seconds }));
  }, [playingUrl]);

  useEffect(() => stop, [stop]);

  return {
    playingUrl,
    progressByUrl,
    durationByUrl,
    toggle,
    seek,
  };
}
