import type {
  CastAssetCollection,
  CastDesignAsset,
} from '../cast-design-types';
import {
  CastSelectedAssetSection,
  CastTakeSection,
} from '../asset-display/cast-asset-sections';

interface CastVoiceDesignTabProps {
  content: CastAssetCollection;
  onOpenDetails: (asset: CastDesignAsset) => void;
  onSelectAsset: (asset: CastDesignAsset) => void;
  onUnselectAsset: (asset: CastDesignAsset) => void;
}

export function CastVoiceDesignTab({
  content,
  onOpenDetails,
  onSelectAsset,
  onUnselectAsset,
}: CastVoiceDesignTabProps) {
  return (
    <div className='flex h-full min-h-0 flex-col gap-4 p-5'>
      <CastSelectedAssetSection
        assets={content.selectedAssets}
        emptyMessage={content.emptySelected}
        onOpenDetails={onOpenDetails}
        onUnselectAsset={onUnselectAsset}
      />
      <CastTakeSection
        assets={content.takes}
        emptyMessage={content.emptyTakes}
        onOpenDetails={onOpenDetails}
        onSelectAsset={onSelectAsset}
      />
    </div>
  );
}
