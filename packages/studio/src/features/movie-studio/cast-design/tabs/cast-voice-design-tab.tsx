import type {
  CastAssetCollectionMockContent,
  CastDesignAsset,
} from '../cast-design-types';
import {
  CastSelectedAssetSection,
  CastTakeSection,
} from '../asset-display/cast-asset-sections';

interface CastVoiceDesignTabProps {
  content: CastAssetCollectionMockContent;
  onOpenDetails: (asset: CastDesignAsset) => void;
}

export function CastVoiceDesignTab({
  content,
  onOpenDetails,
}: CastVoiceDesignTabProps) {
  return (
    <div className='flex h-full min-h-0 flex-col gap-4 p-5'>
      <CastSelectedAssetSection
        assets={content.selectedAssets}
        emptyMessage={content.emptySelected}
        onOpenDetails={onOpenDetails}
      />
      <CastTakeSection
        assets={content.takes}
        emptyMessage={content.emptyTakes}
        onOpenDetails={onOpenDetails}
      />
    </div>
  );
}
