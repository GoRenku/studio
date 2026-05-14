import type { CastMember } from '@gorenku/studio-core/client';
import { CastCard } from './cast-card';

export function CastOverviewPanel({ cast }: { cast: CastMember[] }) {
  return (
    <div className='grid grid-cols-1 lg:grid-cols-2 2xl:grid-cols-3 gap-3'>
      {cast.map((entry) => (
        <CastCard key={entry.id} castEntry={entry} />
      ))}
    </div>
  );
}
