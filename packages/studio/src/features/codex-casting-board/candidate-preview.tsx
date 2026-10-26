import type { CastingRoundKind } from '@gorenku/studio-core/client';
import { CandidatePreviewActions } from '@/features/casting-views/candidate-actions';
import { usePanelMediaUrls, type PanelMediaLibrary } from '@/features/codex-panels/use-panel-media';
import { ImagePreviewDialog } from '@/ui/image-preview-dialog';
import type { BoardCandidate } from './board-summaries';

/** The images the viewer steps through, fixed when it opens so a status change never moves the current one away. */
export interface CandidatePreviewSelection {
  assetFileIds: string[];
  index: number;
}

/** The casting board's image viewer, with hide and Cast (or Pick) for the shown image. */
export function CandidatePreview(input: {
  kind: CastingRoundKind;
  selection: CandidatePreviewSelection;
  candidates: BoardCandidate[];
  chosenAssetFileId: string | null;
  media: PanelMediaLibrary;
  disabled: boolean;
  chooseDisabled: boolean;
  onSelectionChange: (selection: CandidatePreviewSelection | null) => void;
  onToggleHidden: (candidate: BoardCandidate) => void;
  onChoose: (assetFileId: string) => void;
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
          kind={input.kind}
          status={current.status}
          isChosen={current.assetFileId === input.chosenAssetFileId}
          disabled={input.disabled}
          onHide={() => input.onToggleHidden(current)}
          chooseDisabled={input.disabled || input.chooseDisabled}
          onChoose={() => input.onChoose(current.assetFileId)}
        />
      }
    />
  );
}
