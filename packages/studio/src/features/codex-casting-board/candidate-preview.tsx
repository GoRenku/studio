import { CandidatePreviewActions } from '@/features/casting-views/candidate-actions';
import { usePanelMediaUrls, type PanelMediaLibrary } from '@/features/codex-panels/use-panel-media';
import { ImagePreviewDialog } from '@/ui/image-preview-dialog';
import type { BoardCandidate } from './board-summaries';

/** The candidates the viewer steps through, fixed when it opens so a status change never moves the current one away. */
export interface CandidatePreviewSelection {
  assetFileIds: string[];
  index: number;
}

/** The casting board's image viewer, with hide and cast for the shown candidate. */
export function CandidatePreview(input: {
  selection: CandidatePreviewSelection;
  candidates: BoardCandidate[];
  castAssetFileId: string | null;
  media: PanelMediaLibrary;
  disabled: boolean;
  castDisabled: boolean;
  onSelectionChange: (selection: CandidatePreviewSelection | null) => void;
  onToggleHidden: (candidate: BoardCandidate) => void;
  onCast: (assetFileId: string) => void;
}) {
  const { selection } = input;
  const byId = new Map(input.candidates.map((candidate) => [candidate.assetFileId, candidate]));
  const candidates = selection.assetFileIds.flatMap((assetFileId) => byId.get(assetFileId) ?? []);
  const urls = usePanelMediaUrls(input.media, candidates.map((candidate) => candidate.imageUri));
  const shown = candidates.flatMap((candidate) => {
    const url = urls.get(candidate.imageUri);
    return url ? [{ candidate, url }] : [];
  });
  const currentId = selection.assetFileIds[selection.index];
  const index = shown.findIndex((entry) => entry.candidate.assetFileId === currentId);
  const current = shown[index]?.candidate;
  if (!current) return null;
  return (
    <ImagePreviewDialog
      images={shown.map((entry) => {
        const title = `Round ${entry.candidate.roundNumber} · ${entry.candidate.model.name}`;
        return { src: entry.url, alt: title, title };
      })}
      currentIndex={index}
      onCurrentIndexChange={(next) => input.onSelectionChange({
        ...selection,
        index: selection.assetFileIds.indexOf(shown[next]!.candidate.assetFileId),
      })}
      onOpenChange={(open) => { if (!open) input.onSelectionChange(null); }}
      actions={
        <CandidatePreviewActions
          status={current.status}
          isCast={current.assetFileId === input.castAssetFileId}
          disabled={input.disabled}
          onHide={() => input.onToggleHidden(current)}
          castDisabled={input.disabled || input.castDisabled}
          onCast={() => input.onCast(current.assetFileId)}
        />
      }
    />
  );
}
