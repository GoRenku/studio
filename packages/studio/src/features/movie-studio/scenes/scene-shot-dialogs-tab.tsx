import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { Pause, Play } from 'lucide-react';
import type {
  MediaGenerationDependencyPricing,
  ShotVideoTakeDialogueAudioReferenceChoice,
  ShotVideoTakeProductionPlanReport,
} from '@gorenku/studio-core/client';
import type {
  SceneShotListResourceResponse,
} from '@/services/studio-project-contracts';
import type { SaveNotificationStatus } from '@/ui/save-notification';
import {
  readSceneDialogueAudioContext,
  type SceneDialogueAudioContextWithUrls,
} from '@/services/studio-scene-dialogue-audio-api';
import {
  updateShotGroupReferenceInclusion,
  updateTakeDialogueAudioSelection,
  type ShotVideoTakeProductionMutation,
} from '@/services/studio-shot-video-takes-api';
import { Badge } from '@/ui/badge';
import { Button } from '@/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/ui/dialog';
import { ImageSelectionControl } from '@/ui/image-selection-control';
import { Slider } from '@/ui/slider';
import { cn } from '@/lib/utils';
import {
  SceneDialogueAudioTakeRow,
} from './scene-dialogue-audio-takes-tab';
import {
  formatSceneDialogueAudioDuration,
  sceneDialogueAudioTakeLabels,
} from './scene-dialogue-audio-take-format';
import { idleSaveNotification } from '../detail-save-notification';
import { useSceneDialogueAudioPlayer } from './use-scene-dialogue-audio';
import { formatEstimateUsd } from './shot-video-take-production-projection';
import { useTakeEditorMutationStatus } from './use-take-editor-mutation-status';
import { VoiceOverProfilePreview } from '../voice-over-profile-preview';

interface SceneShotDialogsTabProps {
  projectName: string;
  sceneId: string;
  selectedShotId?: string;
  castMemberImages: NonNullable<SceneShotListResourceResponse['castMemberImages']>;
  productionPlan: ShotVideoTakeProductionPlanReport | null;
  onPlanRefresh?: () => Promise<void>;
  onSaveNotificationChange?: (status: SaveNotificationStatus) => void;
}

export function SceneShotDialogsTab({
  projectName,
  sceneId,
  selectedShotId,
  castMemberImages,
  productionPlan,
  onPlanRefresh,
  onSaveNotificationChange,
}: SceneShotDialogsTabProps) {
  const [dialogueAudioContext, setDialogueAudioContext] =
    useState<SceneDialogueAudioContextWithUrls | null>(null);
  const [actionBusy, setActionBusy] = useState(false);
  const mutationStatus = useTakeEditorMutationStatus({
    failureMessage: 'Dialogue choices could not be saved.',
  });
  const player = useSceneDialogueAudioPlayer();
  const choices = useMemo(
    () => productionPlan?.references.dialogueAudio ?? [],
    [productionPlan?.references.dialogueAudio]
  );
  const capability = productionPlan?.references.dialogueAudioCapability ?? null;
  const scopedShotId = selectedShotId ?? productionPlan?.take?.shotIds[0];
  const mutationShotId =
    productionPlan?.take?.state?.structure.mode === 'multi-cut'
      ? scopedShotId
      : undefined;
  const dialogueAudioReloadKey = useMemo(
    () =>
      choices
        .map((choice) =>
          [
            choice.dialogueId,
            choice.selectedTake?.takeId ?? 'none',
            choice.takeCount,
            choice.audioState,
          ].join(':')
        )
        .join('|'),
    [choices]
  );

  const loadDialogueAudio = useCallback(() => {
    let cancelled = false;
    void readSceneDialogueAudioContext(projectName, sceneId).then((context) => {
      if (!cancelled) {
        setDialogueAudioContext(context);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [projectName, sceneId]);

  useEffect(() => loadDialogueAudio(), [loadDialogueAudio, dialogueAudioReloadKey]);
  useEffect(() => {
    onSaveNotificationChange?.(mutationStatus.status);
    return () => onSaveNotificationChange?.(idleSaveNotification);
  }, [mutationStatus.status, onSaveNotificationChange]);

  const updateReferenceInclusion = async (
    dependencyId: string,
    inclusion: 'include' | 'exclude' | null
  ) => {
    const take = productionPlan?.take;
    if (!take) {
      return;
    }
    await mutationStatus.runTakeEditorMutation(async () => {
      const result: ShotVideoTakeProductionMutation =
        await updateShotGroupReferenceInclusion(
          projectName,
          sceneId,
          take.takeId,
          {
            dependencyId,
            inclusion,
            ...(mutationShotId ? { shotId: mutationShotId } : {}),
          }
        );
      void result;
      await onPlanRefresh?.();
    });
  };

  const pickTake = async (dialogueId: string, takeId: string) => {
    const take = productionPlan?.take;
    if (!take) {
      return;
    }
    setActionBusy(true);
    try {
      await mutationStatus.runTakeEditorMutation(async () => {
        await updateTakeDialogueAudioSelection(
          projectName,
          sceneId,
          take.takeId,
          {
            ...(mutationShotId ? { shotId: mutationShotId } : {}),
            dialogueId,
            takeId,
          }
        );
        const context = await readSceneDialogueAudioContext(
          projectName,
          sceneId
        );
        setDialogueAudioContext(context);
        await onPlanRefresh?.();
      });
    } finally {
      setActionBusy(false);
    }
  };

  if (!choices.length) {
    return (
      <div className='py-4'>
        <p className='text-sm text-muted-foreground'>
          No dialogue in this scene.
        </p>
      </div>
    );
  }

  return (
    <div className='py-4'>
      <div className='flex flex-col gap-3'>
        {capability ? <DialogueAudioCapabilityRow capability={capability} /> : null}
        {choices.map((choice) => (
          <SceneShotDialogueAudioReferenceCard
            key={choice.dependencyId}
            choice={choice}
            context={dialogueAudioContext}
            profileImageUrl={
              choice.castMemberId
                ? castMemberImages[choice.castMemberId]?.url ?? null
                : null
            }
            actionDisabled={actionBusy}
            player={player}
            onToggleInclusion={(dependencyId, inclusion) =>
              updateReferenceInclusion(dependencyId, inclusion)
            }
            onPickTake={pickTake}
          />
        ))}
      </div>
    </div>
  );
}

function DialogueAudioCapabilityRow({
  capability,
}: {
  capability: NonNullable<
    ShotVideoTakeProductionPlanReport['references']['dialogueAudioCapability']
  >;
}) {
  const warning = capability.state === 'unsupported' || capability.state === 'over-limit';
  return (
    <div
      className={cn(
        'flex min-h-11 items-center justify-between gap-4 rounded-md border px-3 py-2 text-sm',
        warning
          ? 'border-destructive/30 bg-destructive/10 text-destructive'
          : 'border-border/45 bg-muted/20 text-foreground'
      )}
    >
      <span className='min-w-0 truncate'>{capability.message}</span>
      <Badge
        variant='outline'
        className={cn(
          'shrink-0 border-transparent bg-transparent text-xs tabular-nums',
          warning ? 'text-destructive' : 'text-muted-foreground'
        )}
      >
        {typeof capability.maxCount === 'number'
          ? `${capability.selectedCount} / ${capability.maxCount} selected`
          : `${capability.selectedCount} selected`}
      </Badge>
    </div>
  );
}

function SceneShotDialogueAudioReferenceCard({
  choice,
  context,
  profileImageUrl,
  actionDisabled,
  player,
  onToggleInclusion,
  onPickTake,
}: {
  choice: ShotVideoTakeDialogueAudioReferenceChoice;
  context: SceneDialogueAudioContextWithUrls | null;
  profileImageUrl: string | null;
  actionDisabled: boolean;
  player: ReturnType<typeof useSceneDialogueAudioPlayer>;
  onToggleInclusion: (
    dependencyId: string,
    inclusion: 'include' | 'exclude' | null
  ) => Promise<void>;
  onPickTake: (dialogueId: string, takeId: string) => Promise<void>;
}) {
  const audio = context?.audioByDialogueId[choice.dialogueId] ?? null;
  const takes = audio?.takes ?? [];
  const selectedTake = choice.selectedTake
    ? takes.find((take) => take.takeId === choice.selectedTake?.takeId) ?? null
    : null;
  const singleSelectableTake =
    !selectedTake && choice.audioState === 'no-selected-take' && takes.length === 1
      ? takes[0]
      : null;
  const progress = selectedTake ? player.progressByUrl[selectedTake.url] ?? 0 : 0;
  const duration = selectedTake ? player.durationByUrl[selectedTake.url] ?? 0 : 0;
  const isPlaying = selectedTake ? player.playingUrl === selectedTake.url : false;
  const needsGeneration = choice.card.state === 'selected-planned';
  const opensTakeDialog = choice.takeCount > 1;
  const body = (
    <DialogueCardBody
      choice={choice}
      profileImageUrl={profileImageUrl}
      openable={opensTakeDialog}
    />
  );

  return (
    <div
      className={cn(
        'rounded-md border bg-muted/15 p-3 transition-colors',
        choice.included
          ? 'border-item-active-border bg-item-active-bg/70'
          : 'border-border/45',
        opensTakeDialog
          ? 'hover:border-item-active-border/60 hover:bg-item-hover-bg/50'
          : null
      )}
    >
      <div className='grid grid-cols-[minmax(0,1fr)_auto] items-start gap-3'>
        {opensTakeDialog ? (
          <SceneShotDialogueAudioTakesDialog
            choice={choice}
            takes={takes}
            actionDisabled={actionDisabled}
            player={player}
            onPickTake={onPickTake}
          >
            {body}
          </SceneShotDialogueAudioTakesDialog>
        ) : (
          body
        )}
        <div className='flex items-center gap-2'>
          {singleSelectableTake ? (
            <Button
              type='button'
              variant='outline'
              size='sm'
              disabled={actionDisabled}
              onClick={() => onPickTake(choice.dialogueId, singleSelectableTake.takeId)}
            >
              Pick
            </Button>
          ) : null}
          {needsGeneration ? (
            <DialogueReferenceCostBadge pricing={choice.card.pricing} />
          ) : choice.audioState !== 'ready' ? (
            <Badge variant='outline'>{dialogueAudioStateLabel(choice)}</Badge>
          ) : null}
          {!choice.required ? (
            <ImageSelectionControl
              selected={choice.included}
              selectedLabel={`Exclude ${choice.speakerName} dialogue audio`}
              unselectedLabel={`Include ${choice.speakerName} dialogue audio`}
              onToggleSelected={() =>
                onToggleInclusion(
                  choice.dependencyId,
                  nextReferenceInclusion(choice)
                )
              }
            />
          ) : null}
        </div>
      </div>

      <div className='mt-3 flex items-center gap-3'>
        <Button
          type='button'
          variant='ghost'
          size='icon'
          disabled={!selectedTake}
          onClick={() => {
            if (selectedTake) {
              player.toggle(selectedTake.url);
            }
          }}
          aria-label={isPlaying ? 'Pause dialogue audio' : 'Play dialogue audio'}
        >
          {isPlaying ? (
            <Pause className='h-4 w-4' aria-hidden />
          ) : (
            <Play className='h-4 w-4' aria-hidden />
          )}
        </Button>
        <Slider
          min={0}
          max={duration || 100}
          step={0.1}
          value={[duration ? Math.min(progress, duration) : 0]}
          disabled={!duration}
          sliderSize='sm'
          aria-label={`${choice.speakerName} dialogue playback position`}
          onValueChange={([seconds]) => {
            if (selectedTake && seconds !== undefined) {
              player.seek(selectedTake.url, seconds);
            }
          }}
        />
        <span className='w-12 shrink-0 text-right text-xs text-muted-foreground'>
          {duration ? formatSceneDialogueAudioDuration(duration) : '--:--'}
        </span>
      </div>

      <p className='mt-3 line-clamp-3 text-sm leading-6 text-foreground/88'>
        {choice.plainText}
      </p>
    </div>
  );
}

function DialogueCardBody({
  choice,
  profileImageUrl,
  openable,
}: {
  choice: ShotVideoTakeDialogueAudioReferenceChoice;
  profileImageUrl: string | null;
  openable: boolean;
}) {
  return (
    <div className='flex min-w-0 items-start gap-3 text-left'>
      {profileImageUrl ? (
        <img
          src={profileImageUrl}
          alt={`${choice.speakerName} profile image`}
          className='size-14 shrink-0 rounded-md object-cover'
        />
      ) : choice.speakerName === 'Narrator' ? (
        <span className='size-14 shrink-0 overflow-hidden rounded-md'>
          <VoiceOverProfilePreview size='compact' />
        </span>
      ) : (
        <span
          className='size-14 shrink-0 rounded-md border border-border/45 bg-muted'
          aria-hidden
        />
      )}
      <span className='flex min-w-0 flex-col gap-1'>
        <span className='truncate text-sm font-semibold text-foreground'>
          {choice.speakerName}
        </span>
        <span className='truncate text-xs text-muted-foreground'>
          {choice.selectedTake?.takeLabel ?? dialogueAudioStateLabel(choice)}
        </span>
        {openable ? (
          <span className='text-xs text-muted-foreground'>
            {choice.takeCount} takes
          </span>
        ) : null}
      </span>
    </div>
  );
}

function dialogueAudioStateLabel(
  choice: Pick<
    ShotVideoTakeDialogueAudioReferenceChoice,
    'audioState' | 'unavailableReason'
  >
): string {
  if (choice.audioState === 'not-generated') {
    return 'Not generated';
  }
  if (choice.audioState === 'no-selected-take') {
    return 'No selected take';
  }
  if (choice.audioState === 'missing-file') {
    return 'Missing audio file';
  }
  return choice.unavailableReason ?? 'Unavailable';
}

function DialogueReferenceCostBadge({
  pricing,
}: {
  pricing: MediaGenerationDependencyPricing;
}) {
  if (pricing.state === 'priced') {
    return (
      <Badge
        variant='accent'
        className='border-transparent bg-transparent px-2.5 py-1 text-[10px] tracking-normal text-foreground tabular-nums'
      >
        {formatEstimateUsd(pricing.estimatedUsd)}
      </Badge>
    );
  }
  if (pricing.state === 'unpriced') {
    return (
      <Badge
        variant='outline'
        className='border-transparent bg-transparent px-2.5 py-1 text-[10px] tracking-normal tabular-nums'
      >
        Unpriced
      </Badge>
    );
  }
  return null;
}

function SceneShotDialogueAudioTakesDialog({
  choice,
  takes,
  actionDisabled,
  player,
  children,
  onPickTake,
}: {
  choice: ShotVideoTakeDialogueAudioReferenceChoice;
  takes: NonNullable<
    SceneDialogueAudioContextWithUrls['audioByDialogueId'][string]
  >['takes'];
  actionDisabled: boolean;
  player: ReturnType<typeof useSceneDialogueAudioPlayer>;
  children: ReactNode;
  onPickTake: (dialogueId: string, takeId: string) => Promise<void>;
}) {
  const labels = useMemo(() => sceneDialogueAudioTakeLabels(takes), [takes]);
  const orderedTakes = useMemo(
    () =>
      [...takes].sort(
        (left, right) =>
          Date.parse(right.createdAt) - Date.parse(left.createdAt) ||
          right.takeId.localeCompare(left.takeId)
      ),
    [takes]
  );

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type='button'
          variant='ghost'
          className='h-auto min-w-0 justify-start rounded-md p-0 text-left hover:bg-transparent'
        >
          {children}
        </Button>
      </DialogTrigger>
      <DialogContent className='max-w-2xl'>
        <DialogHeader>
          <DialogTitle>{choice.speakerName}</DialogTitle>
          <DialogDescription className='line-clamp-2'>
            {choice.plainText}
          </DialogDescription>
        </DialogHeader>
        <div className='flex max-h-[60vh] flex-col gap-3 overflow-y-auto pr-1'>
          {orderedTakes.map((take) => (
            <SceneDialogueAudioTakeRow
              key={take.takeId}
              actionDisabled={actionDisabled}
              label={labels.get(take.takeId) ?? 'Take'}
              player={player}
              selected={choice.selectedTake?.takeId === take.takeId}
              take={take}
              onPickTake={(takeId) => onPickTake(choice.dialogueId, takeId)}
            />
          ))}
        </div>
      </DialogContent>
    </Dialog>
  );
}

function nextReferenceInclusion(choice: {
  defaultIncluded: boolean;
  included: boolean;
}): 'include' | 'exclude' | null {
  if (choice.included) {
    return choice.defaultIncluded ? 'exclude' : null;
  }
  return choice.defaultIncluded ? null : 'include';
}
