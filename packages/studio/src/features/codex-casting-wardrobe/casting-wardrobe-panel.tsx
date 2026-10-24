import type { CastingWardrobeDraft, CastingWardrobePanel as CastingWardrobePanelSession } from '@gorenku/studio-codex/casting-wardrobe';
import { CodexPanelNotice } from '@/features/codex-panels/codex-panel-notice';
import { useCodexAnswerPanel } from '@/features/codex-panels/use-codex-answer-panel';
import { usePanelMediaLibrary } from '@/features/codex-panels/use-panel-media';
import { connectCastingWardrobeApp, createCastingWardrobeApp, notifyCastingWardrobe, respondToCastingWardrobe } from '@/services/codex-casting-wardrobe';
import { Alert, AlertDescription } from '@/ui/alert';
import { CostumesPlanView } from './costumes-plan-view';
import { LooksPlanView } from './looks-plan-view';
import type { WardrobeViewProps } from './wardrobe-view-props';

const CASTING_WARDROBE_PANEL = {
  appName: 'Renku Looks and wardrobe',
  resultKey: 'panel',
  create: createCastingWardrobeApp,
  connect: connectCastingWardrobeApp,
  failures: { opening: 'The Looks and wardrobe panel could not be opened.', interaction: 'The Looks and wardrobe interaction failed.' },
};

export function CastingWardrobePanel() {
  const interaction = useCodexAnswerPanel<CastingWardrobePanelSession>(CASTING_WARDROBE_PANEL);
  const media = usePanelMediaLibrary(interaction.bridge);
  const { panel } = interaction;
  if (!panel) {
    return (
      <section className='image-edit p-4'>
        {interaction.error
          ? <Alert variant='destructive'><AlertDescription>{interaction.error}</AlertDescription></Alert>
          : <p role='status' className='m-0 text-sm text-[var(--dd-muted-fg)]'>Loading the plan…</p>}
      </section>
    );
  }
  const disabled = !interaction.connected || interaction.busy;
  const notice = <CodexPanelNotice error={interaction.error} notificationPending={interaction.notificationPending} busy={interaction.busy} onRetryNotification={() => { void interaction.retryNotification(); }} />;
  const respond = (choice: { kind: 'send'; draft: CastingWardrobeDraft } | { kind: 'canceled' }, summary: string) => {
    void interaction.answer(
      (connected, current) => respondToCastingWardrobe(connected, { panelId: current.panelId, choice }),
      (connected, answered) => notifyCastingWardrobe(connected, answered, summary),
    );
  };
  const props: Omit<WardrobeViewProps<never>, 'panel'> = { media, notice, disabled, respond };
  if (panel.answer) {
    return (
      <section aria-label='Looks and wardrobe' className='image-edit rounded-xl border border-[var(--dd-border)]'>
        {notice}
        <p className='m-0 px-4 py-3 text-[13px] text-[var(--dd-muted-fg)]'>{panel.answer.kind === 'send' ? 'Plan sent to the agent.' : 'Plan canceled.'}</p>
      </section>
    );
  }
  return panel.mode === 'looks'
    ? <LooksPlanView key={panel.panelId} panel={panel} {...props} />
    : <CostumesPlanView key={panel.panelId} panel={panel} {...props} />;
}
