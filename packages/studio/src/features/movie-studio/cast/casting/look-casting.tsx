import { useState } from 'react';
import { Columns2, Eye, EyeOff } from 'lucide-react';
import type { CastingCandidateStatus } from '@gorenku/studio-core/client';
import type { SceneStripScene } from '@/features/casting-views/scene-strip';
import type {
  CastCastingLookResponse,
  CastCastingResourceResponse,
  StudioAssetFileResponse,
} from '@/services/studio-project-contracts';
import { AgentRequest, AgentRequestLine } from '@/ui/agent-request';
import { Button } from '@/ui/button';
import { castLookRequest, moreLikeKeptRequest } from '../../agent-request-copy';
import { CastingCompareDialog } from './casting-compare-dialog';
import { CastingRounds } from './casting-rounds';
import { countLabel, lookHiddenCount, lookKept } from './casting-summaries';
import { CostumeSheets } from './costume-sheets';

/**
 * The picked Look: its rounds and Compare, then its costumes once it is cast. At most one
 * "Ask your agent" card shows, for the Look's next step; optional follow-ups are a quiet line.
 */
export function LookCasting({
  castMemberName,
  look,
  costumes,
  characterSheets,
  scenes,
  pendingAssetFileId,
  onStatusChange,
  onCast,
  onPickSheet,
}: {
  castMemberName: string;
  look: CastCastingLookResponse;
  /** Every costume of the Cast Member; the Look's own are shown once it is cast. */
  costumes: CastCastingResourceResponse['costumes'];
  characterSheets: StudioAssetFileResponse[];
  scenes: SceneStripScene[];
  pendingAssetFileId: string | null;
  onStatusChange: (assetFileId: string, status: CastingCandidateStatus) => void;
  onCast: (lookId: string, assetFileId: string) => void;
  onPickSheet: (costumeId: string, assetFileId: string) => void;
}) {
  const [comparing, setComparing] = useState(false);
  const [showHidden, setShowHidden] = useState(false);
  const kept = lookKept(look);
  const hiddenCount = lookHiddenCount(look);
  const cast = look.castCandidateAssetFileId !== null;
  return (
    <section aria-label={look.name} className='flex flex-col gap-4 border-t border-border/40 pt-5'>
      <header className='flex flex-wrap items-center gap-3'>
        <h3 className='text-[15px] font-bold'>{look.name}</h3>
        <span className='text-xs text-muted-foreground'>{countLabel(look.sceneIds.length, 'scene')}</span>
        {kept.length >= 2 ? (
          <Button type='button' variant='outline' size='sm' className='ml-auto h-7 gap-1.5 text-[12px]' onClick={() => setComparing(true)}>
            <Columns2 aria-hidden='true' className='h-3.5 w-3.5' />
            Compare {kept.length}
          </Button>
        ) : null}
      </header>
      {look.rounds.length === 0 ? (
        <div className='flex flex-col items-center gap-3 rounded-[10px] bg-muted/30 px-4 py-6'>
          <p className='text-sm font-semibold'>No casting rounds yet</p>
          <AgentRequest request={castLookRequest(castMemberName, look.name)} className='max-w-xl' />
        </div>
      ) : (
        <CastingRounds look={look} showHidden={showHidden} pendingAssetFileId={pendingAssetFileId} onStatusChange={onStatusChange} onCast={onCast} />
      )}
      {hiddenCount > 0 ? (
        <Button type='button' variant='ghost' size='sm' aria-pressed={showHidden} className='h-7 gap-1.5 self-start px-2 text-[12px] text-muted-foreground' onClick={() => setShowHidden(!showHidden)}>
          {showHidden ? <EyeOff aria-hidden='true' className='h-3.5 w-3.5' /> : <Eye aria-hidden='true' className='h-3.5 w-3.5' />}
          {showHidden ? `Fold away ${hiddenCount} hidden` : `Show ${hiddenCount} hidden`}
        </Button>
      ) : null}
      {!cast && kept.length > 0 ? (
        <AgentRequestLine request={moreLikeKeptRequest(castMemberName, look.name)} />
      ) : null}
      {cast ? (
        <CostumeSheets
          castMemberName={castMemberName}
          costumes={costumes.filter((costume) => costume.lookId === look.id)}
          characterSheets={characterSheets}
          scenes={scenes}
          pendingAssetFileId={pendingAssetFileId}
          onPick={onPickSheet}
        />
      ) : null}
      <CastingCompareDialog
        look={look}
        open={comparing}
        onOpenChange={setComparing}
        pendingAssetFileId={pendingAssetFileId}
        onCast={(assetFileId) => onCast(look.id, assetFileId)}
        onHide={(assetFileId) => onStatusChange(assetFileId, 'hidden')}
      />
    </section>
  );
}
