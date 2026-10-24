import type { ReactNode } from 'react';
import type { CastingWardrobeDraft } from '@gorenku/studio-codex/casting-wardrobe';
import type { PanelMediaLibrary } from '@/features/codex-panels/use-panel-media';

/** What each wardrobe mode view receives from the panel. */
export interface WardrobeViewProps<TPanel> {
  panel: TPanel;
  media: PanelMediaLibrary;
  notice: ReactNode;
  disabled: boolean;
  respond: (choice: { kind: 'send'; draft: CastingWardrobeDraft } | { kind: 'canceled' }, summary: string) => void;
}
