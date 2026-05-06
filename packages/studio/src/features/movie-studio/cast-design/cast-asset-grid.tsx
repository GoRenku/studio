import type { CastDesignTab, CastTake } from './cast-design-types';
import { cn } from '@/lib/utils';
import { CastAssetCard } from './cast-asset-card';
import { EmptyCastAssets } from './empty-cast-assets';
import { NewTakeCard } from './new-take-card';

interface CastAssetGridProps {
  activeTab: CastDesignTab;
  takes: CastTake[];
  emptyMessage: string;
  includeNewTake?: boolean;
  selectedSection?: boolean;
  onNewTake: () => void;
  onOpenDetails: (take: CastTake) => void;
}

export function CastAssetGrid({
  activeTab,
  takes,
  emptyMessage,
  includeNewTake = false,
  selectedSection = false,
  onNewTake,
  onOpenDetails,
}: CastAssetGridProps) {
  if (takes.length === 0 && !includeNewTake) {
    return <EmptyCastAssets message={emptyMessage} />;
  }

  return (
    <div
      className={cn(
        'h-full min-h-0 overflow-y-auto',
        selectedSection ? 'p-4' : 'p-5'
      )}
    >
      <div
        className={cn(
          'flex flex-wrap items-start content-start pr-2',
          selectedSection ? 'gap-4' : 'gap-5'
        )}
      >
        {includeNewTake && activeTab === 'description' ? (
          <>
            <NewTakeCard
              activeTab={activeTab}
              variant='description-text'
              onClick={onNewTake}
            />
            <NewTakeCard
              activeTab={activeTab}
              variant='description-image'
              onClick={onNewTake}
            />
          </>
        ) : includeNewTake ? (
          <NewTakeCard activeTab={activeTab} onClick={onNewTake} />
        ) : null}
        {takes.map((take) => (
          <CastAssetCard
            key={take.id}
            take={take}
            selectedSection={selectedSection}
            onOpenDetails={onOpenDetails}
          />
        ))}
      </div>
    </div>
  );
}
