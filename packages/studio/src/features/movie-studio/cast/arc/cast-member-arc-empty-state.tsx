import { PanelEmptyState } from '@/ui/panel-empty-state';
import {
  analyzeScreenplayAndWriteArcsRequest,
  characterArcRequest,
} from '../../agent-request-copy';

/** The Arc tab before an arc exists; the request depends on whether the screenplay is analyzed. */
export function CastMemberArcEmptyState({
  castMemberName,
  screenplayAnalyzed,
}: {
  castMemberName: string;
  screenplayAnalyzed: boolean;
}) {
  return (
    <PanelEmptyState
      prerequisite={<ArcSketch />}
      title={`${castMemberName}'s arc isn't written yet`}
      description={
        screenplayAnalyzed
          ? 'Arcs trace how a character changes, act by act. Your agent can write one for this character.'
          : 'A screenplay analysis traces how each main character changes, act by act, and fills in this tab.'
      }
      request={
        screenplayAnalyzed
          ? characterArcRequest(castMemberName)
          : analyzeScreenplayAndWriteArcsRequest
      }
    />
  );
}

function ArcSketch() {
  return (
    <svg
      aria-hidden='true'
      viewBox='0 0 220 56'
      fill='none'
      className='mx-auto h-14 w-[220px] text-border'
    >
      <path
        d='M4 44 C 40 44, 52 30, 80 30 S 120 46, 150 22 S 196 8, 216 10'
        stroke='currentColor'
        strokeWidth='2'
        strokeDasharray='4 6'
        strokeLinecap='round'
      />
      <circle cx='4' cy='44' r='4' fill='currentColor' />
      <circle cx='216' cy='10' r='4' className='stroke-primary' strokeWidth='2' />
    </svg>
  );
}
