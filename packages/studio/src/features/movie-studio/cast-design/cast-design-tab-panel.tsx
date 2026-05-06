import type { CastDesignTab, CastTabContent, CastTake } from './cast-design-types';
import { CastAssetGrid } from './cast-asset-grid';
import { CastSection } from './cast-section';
import { EmptyCastAssets } from './empty-cast-assets';

interface CastDesignTabPanelProps {
  activeTab: CastDesignTab;
  content: CastTabContent;
  onNewTake: () => void;
  onOpenDetails: (take: CastTake) => void;
}

export function CastDesignTabPanel({
  activeTab,
  content,
  onNewTake,
  onOpenDetails,
}: CastDesignTabPanelProps) {
  return (
    <div className='h-full min-h-0 p-5 flex flex-col gap-4'>
      <CastSection title='Selected Assets' className='shrink-0'>
        {content.selectedAssets.length > 0 ? (
          <div className='max-h-[280px] overflow-y-auto'>
            <CastAssetGrid
              key={`${activeTab}-selected`}
              activeTab={activeTab}
              takes={content.selectedAssets}
              emptyMessage={content.emptySelected}
              selectedSection
              onNewTake={onNewTake}
              onOpenDetails={onOpenDetails}
            />
          </div>
        ) : (
          <EmptyCastAssets message={content.emptySelected} />
        )}
      </CastSection>

      <CastSection title='Takes' className='flex-1'>
        <CastAssetGrid
          key={`${activeTab}-takes`}
          activeTab={activeTab}
          takes={content.takes}
          emptyMessage={content.emptyTakes}
          includeNewTake
          onNewTake={onNewTake}
          onOpenDetails={onOpenDetails}
        />
      </CastSection>
    </div>
  );
}
