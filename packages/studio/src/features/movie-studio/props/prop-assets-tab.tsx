import type { StudioAssetResponse } from '@/services/studio-project-contracts';
import { ContinuityImageAssetsTab } from '../continuity/continuity-image-assets-tab';

export function PropAssetsTab({
  projectName,
  assets,
  selectedHeroAssetId,
  onToggleHero,
  onDeleteAsset,
}: {
  projectName: string;
  assets: StudioAssetResponse[];
  selectedHeroAssetId: string | null;
  onToggleHero: (asset: StudioAssetResponse) => Promise<void>;
  onDeleteAsset: (asset: StudioAssetResponse) => Promise<void>;
}) {
  return (
    <ContinuityImageAssetsTab
      projectName={projectName}
      assets={assets}
      selectedCanonicalAssetId={selectedHeroAssetId}
      canonicalType='prop_hero'
      sheetTypes={['prop_sheet']}
      canonicalTitle='Prop Hero'
      canonicalPluralTitle='Hero Images'
      sheetTitle='Prop Sheet'
      sheetPluralTitle='Prop Sheets'
      onToggleCanonical={onToggleHero}
      onDeleteAsset={onDeleteAsset}
    />
  );
}
