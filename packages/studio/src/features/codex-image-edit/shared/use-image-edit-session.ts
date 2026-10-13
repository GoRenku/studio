import type { ImageEditDraft, ImageEditGenerateReceipt, ImageEditSession } from '@gorenku/studio-codex/image-edit';
import { useCodexPanelSession } from '@/features/codex-panels/use-codex-panel-session';
import type { CodexApp } from '@/services/codex-app';
import { connectImageEditApp, createImageEditApp, generateImageEdit, notifyImageEditGenerate, readImageEditSession } from '@/services/codex-image-edit';
import { imageTypeLabel } from './image-type-label';

const FAILURES = { opening: 'The image edit panel could not be opened.', interaction: 'The image edit interaction failed.' };

/** "<owner> · <image type> Take N" for the version an action edits. */
export function imageEditSubject(session: ImageEditSession, assetFileId: string | null): string {
  const take = session.versions.find((version) => version.assetFileId === assetFileId)?.takeNumber;
  const image = `${imageTypeLabel(session.imageType)}${take ? ` Take ${take}` : ''}`;
  return session.owner.name ? `${session.owner.name} · ${image}` : image;
}

export function useImageEditSession(appName: string) {
  const panel = useCodexPanelSession<ImageEditSession, ImageEditGenerateReceipt>({
    appName,
    create: createImageEditApp,
    connect: connectImageEditApp,
    read: readImageEditSession,
    notify: (bridge: CodexApp, receipt: ImageEditGenerateReceipt) => notifyImageEditGenerate(bridge, receipt, imageEditSubject(receipt.session, receipt.session.action?.baseAssetFileId ?? null)),
    failures: FAILURES,
  });

  const generate = (draft: ImageEditDraft) => {
    return panel.generate((connected, current) => generateImageEdit(connected, { sessionId: current.sessionId, draft }));
  };

  return {
    bridge: panel.bridge,
    session: panel.session,
    connected: panel.connected,
    busy: panel.busy,
    error: panel.error,
    actionActive: panel.actionActive,
    completedAssetFileId: panel.newCompletion?.assetFileId,
    notificationPending: panel.notificationPending,
    generate,
    retryNotification: panel.retryNotification,
  };
}

export type ImageEditSessionInteraction = ReturnType<typeof useImageEditSession>;
