import { useEffect, useState } from 'react';
import type { ImageEditResolution, ImageEditSession } from '@gorenku/studio-codex/image-edit';
import { CodexPanelNotice, CodexPanelPending } from '@/features/codex-panels/codex-panel-notice';
import { usePanelMediaLibrary, usePanelMediaUrl, type PanelMediaLibrary } from '@/features/codex-panels/use-panel-media';
import { imageEditGenerateReadiness, nextImageEditTakeNumber } from '../shared/generate-readiness';
import { ImageEditGenerateBar } from '../shared/image-edit-generate-bar';
import { ImageEditPanelFrame } from '../shared/image-edit-panel-frame';
import { ImageEditStageToolbar } from '../shared/image-edit-stage-toolbar';
import { ImageTakeStrip } from '../shared/image-take-strip';
import { RegionCanvas } from '../shared/region-canvas';
import { RegionList, type RegionModeOption } from '../shared/region-list';
import { StyleReferencePicker } from '../shared/style-reference-picker';
import { useImageEditSession, type ImageEditSessionInteraction } from '../shared/use-image-edit-session';
import { useRegionDraft } from '../shared/use-region-draft';
import { WholeImageDirection } from '../shared/whole-image-direction';
import { Flux3OutputSettings } from './flux-3-output-settings';

const FLUX_3_MODEL_LABEL = 'FLUX 3 Image · Fal.ai';
const FLUX_3_GENERATE_DISCLOSURE = 'Generate uploads this image and any references it needs to Fal.ai and runs one paid FLUX 3 Image Edit with your saved Fal.ai key.';

function flux3Approval(resolution: ImageEditResolution): string {
  return `I approve uploading this image and any references it needs to Fal.ai and running one paid FLUX 3 Image Edit at ${resolution.toUpperCase()} with my saved Fal.ai key.`;
}

const FLUX_3_REGION_MODES: RegionModeOption[] = [
  { mode: 'edit', label: 'Edit', requiresInstruction: true, placeholder: 'What should change here?' },
  { mode: 'remove', label: 'Remove', requiresInstruction: false, placeholder: 'Optional: what should fill the space' },
];

export function Flux3ImageEditPanel() {
  const interaction = useImageEditSession('Renku FLUX 3 image edit');
  const media = usePanelMediaLibrary(interaction.bridge);
  const { session } = interaction;
  if (!session) return <CodexPanelPending error={interaction.error} label='image edit' themeClass='image-edit' />;
  if (session.panel !== 'flux-3') return <CodexPanelPending error='This session belongs to another image edit panel.' label='image edit' themeClass='image-edit' />;
  return <Flux3ImageEditDesk key={session.sessionId} session={session} interaction={interaction} media={media} />;
}

function Flux3ImageEditDesk(input: { session: ImageEditSession; interaction: ImageEditSessionInteraction; media: PanelMediaLibrary }) {
  const { session, interaction, media } = input;
  const draft = useRegionDraft('edit');
  const [wholeImageInstruction, setWholeImageInstruction] = useState(session.initial.wholeImageInstruction);
  const [styleReferenceAssetFileId, setStyleReferenceAssetFileId] = useState<string | null>(null);
  const [resolution, setResolution] = useState<ImageEditResolution>(session.initial.resolution);
  // The newest reported result is shown with its comparison until the user picks another view.
  const [view, setView] = useState<{ assetFileId: string | null; comparing: boolean; seenCompletion?: string }>({ assetFileId: session.editBaseAssetFileId ?? session.versions[0]?.assetFileId ?? null, comparing: false });
  const completed = interaction.completedAssetFileId;
  const current = completed && completed !== view.seenCompletion ? { assetFileId: completed, comparing: true } : view;
  const showView = (assetFileId: string | null, comparing: boolean) => setView({ assetFileId, comparing, seenCompletion: completed });
  const shownAssetFileId = current.assetFileId;
  const comparing = current.comparing;
  const [regionsHidden, setRegionsHidden] = useState(false);

  const shown = session.versions.find((version) => version.assetFileId === shownAssetFileId) ?? session.versions.find((version) => version.assetFileId === session.editBaseAssetFileId) ?? session.versions[0];
  const parent = shown?.parentAssetFileId ? session.versions.find((version) => version.assetFileId === shown.parentAssetFileId) : undefined;
  const onEditBase = Boolean(shown && shown.assetFileId === session.editBaseAssetFileId);
  const comparison = comparing && parent ? parent : undefined;
  const canDraw = onEditBase && !comparison && !regionsHidden;
  const { url: shownUrl } = usePanelMediaUrl(media, shown?.imageUri ?? null);
  const { url: parentUrl } = usePanelMediaUrl(media, comparison?.imageUri ?? null);
  const readiness = imageEditGenerateReadiness({ session, regions: draft.regions, wholeImageInstruction, modes: FLUX_3_REGION_MODES });
  const editBase = session.versions.find((version) => version.assetFileId === session.editBaseAssetFileId);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement | null)?.closest('textarea, input, select, [role="dialog"]')) return;
      if ((event.key === 'h' || event.key === 'H') && onEditBase && !comparison) setRegionsHidden((hidden) => !hidden);
      if ((event.key === 'Delete' || event.key === 'Backspace') && canDraw && draft.selectedNumber !== null) draft.remove(draft.selectedNumber);
      if (event.key === 'Escape') draft.select(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [canDraw, comparison, draft, onEditBase]);

  const generate = () => {
    if (!readiness.ready || !interaction.connected || interaction.busy || !session.editBaseAssetFileId) return;
    void interaction.generate({
      panel: 'flux-3',
      baseAssetFileId: session.editBaseAssetFileId,
      wholeImageInstruction,
      styleReferenceAssetFileId,
      regions: draft.regions,
      resolution,
    }, flux3Approval(resolution));
  };
  const directionDisabled = !interaction.connected;
  const failure = session.action?.status === 'failed' ? session.action.message : undefined;

  return (
    <ImageEditPanelFrame
      session={session}
      modelLabel={FLUX_3_MODEL_LABEL}
      notice={<CodexPanelNotice error={interaction.error ?? failure} notificationPending={interaction.notificationPending} busy={interaction.busy} onRetryNotification={() => { void interaction.retryNotification(); }} />}
      stage={(
        <>
          <ImageTakeStrip
            versions={session.versions}
            shownAssetFileId={shown?.assetFileId ?? null}
            generatingTakeNumber={interaction.actionActive ? nextImageEditTakeNumber(session) : null}
            media={media}
            onShow={(assetFileId) => showView(assetFileId, assetFileId !== session.editBaseAssetFileId && Boolean(session.versions.find((version) => version.assetFileId === assetFileId)?.parentAssetFileId))}
          />
          <ImageEditStageToolbar
            onEditBase={onEditBase}
            canDraw={canDraw}
            regionsHidden={regionsHidden}
            hasRegions={draft.regions.length > 0}
            comparison={parent ? { parentTakeNumber: parent.takeNumber, active: Boolean(comparison) } : null}
            onToggleRegions={() => setRegionsHidden((hidden) => !hidden)}
            onClearRegions={draft.clear}
            onToggleComparison={() => showView(shown?.assetFileId ?? null, !comparison)}
          />
          {shown && !onEditBase ? (
            <p className='m-0 border-b border-[var(--dd-border)] bg-[var(--dd-card)] px-3.5 py-2 text-xs text-[var(--dd-card-fg)]'>
              Viewing Take {shown.takeNumber}. {editBase
                ? `New edits start from ${session.selectable ? 'the selected' : 'the latest version,'} Take ${editBase.takeNumber}.${session.selectable ? ' Change the selection in Studio.' : ''}`
                : 'No image is selected. Select one in Studio.'}
            </p>
          ) : null}
          <RegionCanvas
            imageUrl={shownUrl}
            comparison={comparison ? { beforeUrl: parentUrl, beforeLabel: `Take ${comparison.takeNumber}`, afterLabel: `Take ${shown!.takeNumber}` } : null}
            regions={draft.regions}
            selectedNumber={draft.selectedNumber}
            editable={canDraw}
            nextNumber={draft.nextNumber}
            onSelect={draft.select}
            onCreate={draft.create}
            onChange={draft.move}
          />
        </>
      )}
      direction={(
        <>
          <WholeImageDirection value={wholeImageInstruction} disabled={directionDisabled} onChange={setWholeImageInstruction} onSubmit={generate} />
          <StyleReferencePicker references={session.styleReferences} selectedAssetFileId={styleReferenceAssetFileId} disabled={directionDisabled} media={media} onChange={setStyleReferenceAssetFileId} />
          <RegionList
            regions={draft.regions}
            modes={FLUX_3_REGION_MODES}
            selectedNumber={draft.selectedNumber}
            focusNumber={draft.focusNumber}
            disabled={directionDisabled}
            onSelect={draft.select}
            onModeChange={draft.setMode}
            onInstructionChange={draft.setInstruction}
            onDelete={draft.remove}
            onSubmit={generate}
          />
          <Flux3OutputSettings resolution={resolution} disabled={directionDisabled} onResolutionChange={setResolution} />
        </>
      )}
      footer={(
        <ImageEditGenerateBar
          message={readiness.message}
          disclosure={FLUX_3_GENERATE_DISCLOSURE}
          problem={readiness.problem}
          generating={interaction.actionActive}
          disabled={!readiness.ready || !interaction.connected || interaction.busy}
          onGenerate={generate}
        />
      )}
    />
  );
}
