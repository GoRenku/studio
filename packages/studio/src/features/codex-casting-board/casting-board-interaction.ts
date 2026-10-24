import type { ReactNode } from 'react';
import type { CastingBoard } from '@gorenku/studio-codex/casting-board';
import type { useCodexPanelSession } from '@/features/codex-panels/use-codex-panel-session';
import type { PanelMediaLibrary } from '@/features/codex-panels/use-panel-media';
import type { CastingBoardRequestReceipt } from '@/services/codex-casting-board';

/** What each board mode view receives from the panel. */
export interface CastingBoardInteraction {
  interaction: ReturnType<typeof useCodexPanelSession<CastingBoard, CastingBoardRequestReceipt>>;
  media: PanelMediaLibrary;
  notice: ReactNode;
}
