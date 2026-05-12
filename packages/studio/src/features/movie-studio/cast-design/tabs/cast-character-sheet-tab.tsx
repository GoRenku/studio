import type {
  CastAssetCollection,
  CastDesignAsset,
} from '../cast-design-types';
import {
  CastSelectedAssetSection,
  CastTakeSection,
} from '../asset-display/cast-asset-sections';

interface CastCharacterSheetTabProps {
  content: CastAssetCollection;
  onNewTake: () => void;
  onOpenDetails: (asset: CastDesignAsset) => void;
  onSelectAsset: (asset: CastDesignAsset) => void;
  onUnselectAsset: (asset: CastDesignAsset) => void;
}

export function CastCharacterSheetTab({
  content,
  onNewTake,
  onOpenDetails,
  onSelectAsset,
  onUnselectAsset,
}: CastCharacterSheetTabProps) {
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
        newTakeEnabled
        onNewTake={onNewTake}
        onOpenDetails={onOpenDetails}
        onSelectAsset={onSelectAsset}
      />
    </div>
  );
}
