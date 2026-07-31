import type { StudioAssetResponse } from '@/services/studio-project-contracts';
import { ContinuityImageAssetsTab } from '../continuity/continuity-image-assets-tab';

interface LocationVisualContentTabProps {
  projectName: string;
  assets: StudioAssetResponse[];
  selectedHeroAssetId: string | null;
  onToggleHeroDisplay: (asset: StudioAssetResponse) => Promise<void>;
  onDeleteAsset: (asset: StudioAssetResponse) => Promise<void>;
}

export function LocationVisualContentTab({
  projectName,
  assets,
  selectedHeroAssetId,
  onToggleHeroDisplay,
  onDeleteAsset,
}: LocationVisualContentTabProps) {
  return (
    <ContinuityImageAssetsTab
      projectName={projectName}
      assets={assets}
      selectedCanonicalAssetId={selectedHeroAssetId}
      canonicalType='location_hero'
      sheetTypes={['location_sheet']}
      canonicalTitle='Location Hero'
      canonicalPluralTitle='Hero Images'
      sheetTitle='Location Sheet'
      sheetPluralTitle='Location Sheets'
      onToggleCanonical={onToggleHeroDisplay}
      onDeleteAsset={onDeleteAsset}
    />
  );
}
