import type { CastingBoard } from '@gorenku/studio-codex/casting-board';
import { CodexPanelNotice } from '@/features/codex-panels/codex-panel-notice';
import { useCodexPanelSession } from '@/features/codex-panels/use-codex-panel-session';
import { usePanelMediaLibrary } from '@/features/codex-panels/use-panel-media';
import {
  connectCastingBoardApp,
  createCastingBoardApp,
  notifyCastingBoardRequest,
  readCastingBoard,
  type CastingBoardRequestReceipt,
} from '@/services/codex-casting-board';
import type { CodexApp } from '@/services/codex-app';
import { Alert, AlertDescription } from '@/ui/alert';
import { boardRequestSummary } from './board-summaries';
import { CandidateBoardView } from './candidate-board-view';
import type { CastingBoardInteraction } from './casting-board-interaction';
import { SheetBoardView } from './sheet-board-view';

const CASTING_BOARD_SESSION = {
  appName: 'Renku casting board',
  create: createCastingBoardApp,
  connect: connectCastingBoardApp,
  read: readCastingBoard,
  notify: (bridge: CodexApp, receipt: CastingBoardRequestReceipt) => notifyCastingBoardRequest(bridge, receipt, boardRequestSummary(receipt)),
  failures: { opening: 'The casting board could not be opened.', interaction: 'The casting board interaction failed.' },
};

export function CastingBoardPanel() {
  const interaction = useCodexPanelSession<CastingBoard, CastingBoardRequestReceipt>(CASTING_BOARD_SESSION);
  const media = usePanelMediaLibrary(interaction.bridge);
  const { session } = interaction;
  if (!session) {
    return (
      <section className='image-edit p-4'>
        {interaction.error
          ? <Alert variant='destructive'><AlertDescription>{interaction.error}</AlertDescription></Alert>
          : <p role='status' className='m-0 text-sm text-[var(--dd-muted-fg)]'>Loading the casting board…</p>}
      </section>
    );
  }
  const notice = <CodexPanelNotice error={interaction.error} notificationPending={interaction.notificationPending} busy={interaction.busy} onRetryNotification={() => { void interaction.retryNotification(); }} />;
  const board: CastingBoardInteraction = { interaction, media, notice };
  return session.mode === 'candidates'
    ? <CandidateBoardView key={session.sessionId} board={session} {...board} />
    : <SheetBoardView key={session.sessionId} board={session} {...board} />;
}
