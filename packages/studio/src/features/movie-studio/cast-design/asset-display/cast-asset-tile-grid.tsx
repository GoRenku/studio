import { cn } from '@/lib/utils';
import type { CastDesignAsset } from '../cast-design-types';
import { CastAssetTile } from './cast-asset-tile';
import { EmptyCastAssets } from './empty-cast-assets';

interface CastAssetTileGridProps {
  assets: CastDesignAsset[];
  emptyMessage: string;
  selectedSection?: boolean;
  onOpenDetails: (asset: CastDesignAsset) => void;
}

export function CastAssetTileGrid({
  assets,
  emptyMessage,
  selectedSection = false,
  onOpenDetails,
}: CastAssetTileGridProps) {
  if (assets.length === 0) {
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
          'flex flex-wrap content-start items-start pr-2',
          selectedSection ? 'gap-4' : 'gap-5'
        )}
      >
        {assets.map((asset) => (
          <CastAssetTile
            key={asset.id}
            asset={asset}
            selectedSection={selectedSection}
            onOpenDetails={onOpenDetails}
          />
        ))}
      </div>
    </div>
  );
}
