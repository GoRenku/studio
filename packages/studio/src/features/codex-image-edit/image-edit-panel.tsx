import { useEffect, useState } from 'react';
import type { ImageEditSession } from '@gorenku/studio-codex/image-edit';
import type { JsonValue } from '@gorenku/studio-core/client';
import { CodexPanelNotice, CodexPanelPending } from '@/features/codex-panels/codex-panel-notice';
import { initialNativeRequestValues } from '@/features/codex-panels/native-request-values';
import { usePanelMediaLibrary, usePanelMediaUrl, type PanelMediaLibrary } from '@/features/codex-panels/use-panel-media';
import { imageEditGenerateReadiness, nextImageEditTakeNumber } from './shared/generate-readiness';
import { imageEditGenerateDisclosure } from './shared/image-edit-disclosure';
import { ImageEditGenerateBar } from './shared/image-edit-generate-bar';
import { ImageEditOutputSettings } from './shared/image-edit-output-settings';
import { ImageEditPanelFrame } from './shared/image-edit-panel-frame';
import { ImageEditStageToolbar } from './shared/image-edit-stage-toolbar';
import { ImageTakeStrip } from './shared/image-take-strip';
import { RegionCanvas } from './shared/region-canvas';
import { RegionList } from './shared/region-list';
import { StyleReferencePicker } from './shared/style-reference-picker';
import { useImageEditSession, type ImageEditSessionInteraction } from './shared/use-image-edit-session';
import { useRegionDraft } from './shared/use-region-draft';
import { WholeImageDirection } from './shared/whole-image-direction';

/** The one image edit panel; the route's region modes, style reference and controls shape it. */
export function ImageEditPanel() {
  const interaction = useImageEditSession('Renku image edit');
  const media = usePanelMediaLibrary(interaction.bridge);
  const { session } = interaction;
  if (!session) return <CodexPanelPending error={interaction.error} label='image edit' themeClass='image-edit' />;
  return <ImageEditDesk key={session.sessionId} session={session} interaction={interaction} media={media} />;
}

function ImageEditDesk(input: { session: ImageEditSession; interaction: ImageEditSessionInteraction; media: PanelMediaLibrary }) {
  const { session, interaction, media } = input;
  const { route } = session;
  const regionModes = route.regionModes;
  const draft = useRegionDraft(regionModes?.[0]?.id ?? '');
  const [wholeImageInstruction, setWholeImageInstruction] = useState(session.initialWholeImageInstruction);
  const [styleReferenceAssetFileId, setStyleReferenceAssetFileId] = useState<string | null>(null);
  const [values, setValues] = useState<Record<string, JsonValue>>(() => initialNativeRequestValues(route.controls));
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
  const canDraw = Boolean(regionModes) && onEditBase && !comparison && !regionsHidden;
  const { url: shownUrl } = usePanelMediaUrl(media, shown?.imageUri ?? null);
  const { url: parentUrl } = usePanelMediaUrl(media, comparison?.imageUri ?? null);
  const readiness = imageEditGenerateReadiness({ session, regions: draft.regions, wholeImageInstruction });
  const editBase = session.versions.find((version) => version.assetFileId === session.editBaseAssetFileId);

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if ((event.target as HTMLElement | null)?.closest('textarea, input, select, [role="dialog"]')) return;
      if ((event.key === 'h' || event.key === 'H') && regionModes && onEditBase && !comparison) setRegionsHidden((hidden) => !hidden);
      if ((event.key === 'Delete' || event.key === 'Backspace') && canDraw && draft.selectedNumber !== null) draft.remove(draft.selectedNumber);
      if (event.key === 'Escape') draft.select(null);
    };
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  }, [canDraw, comparison, draft, onEditBase, regionModes]);

  const generate = () => {
    if (!readiness.ready || !interaction.connected || interaction.busy || !session.editBaseAssetFileId) return;
    void interaction.generate({
      baseAssetFileId: session.editBaseAssetFileId,
      wholeImageInstruction,
      styleReferenceAssetFileId,
      regions: draft.regions,
      values,
    });
  };
  const directionDisabled = !interaction.connected;
  const failure = session.action?.status === 'failed' ? session.action.message : undefined;

  return (
    <ImageEditPanelFrame
      session={session}
      routeLabel={`${route.label} · ${route.providerLabel}`}
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
            regionTools={Boolean(regionModes)}
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
            defaultModeId={regionModes?.[0]?.id ?? null}
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
          {route.styleReference ? <StyleReferencePicker references={session.styleReferences} selectedAssetFileId={styleReferenceAssetFileId} disabled={directionDisabled} media={media} onChange={setStyleReferenceAssetFileId} /> : null}
          {regionModes ? (
            <RegionList
              regions={draft.regions}
              modes={regionModes}
              selectedNumber={draft.selectedNumber}
              focusNumber={draft.focusNumber}
              disabled={directionDisabled}
              onSelect={draft.select}
              onModeChange={draft.setMode}
              onInstructionChange={draft.setInstruction}
              onDelete={draft.remove}
              onSubmit={generate}
            />
          ) : null}
          <ImageEditOutputSettings controls={route.controls} values={values} disabled={directionDisabled} onChange={(key, value) => setValues((current) => ({ ...current, [key]: value }))} />
        </>
      )}
      footer={(
        <ImageEditGenerateBar
          message={readiness.message}
          disclosure={imageEditGenerateDisclosure(route)}
          problem={readiness.problem}
          generating={interaction.actionActive}
          disabled={!readiness.ready || !interaction.connected || interaction.busy}
          onGenerate={generate}
        />
      )}
    />
  );
}
