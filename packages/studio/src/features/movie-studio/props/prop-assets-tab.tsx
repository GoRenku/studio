import type { StudioAssetFileResponse } from '@/services/studio-project-contracts';
import { ContinuityImageAssetFilesTab } from '../continuity/continuity-image-assets-tab';

export function PropAssetFilesTab({
  projectName,
  assetFiles,
  selectedHeroAssetFileId,
  onToggleHero,
  onDeleteAssetFile,
}: {
  projectName: string;
  assetFiles: StudioAssetFileResponse[];
  selectedHeroAssetFileId: string | null;
  onToggleHero: (assetFile: StudioAssetFileResponse) => Promise<void>;
  onDeleteAssetFile: (assetFile: StudioAssetFileResponse) => Promise<void>;
}) {
  return (
    <ContinuityImageAssetFilesTab
      projectName={projectName}
      assetFiles={assetFiles}
      selectedCanonicalAssetFileId={selectedHeroAssetFileId}
      canonicalType='prop_hero'
      sheetTypes={['prop_sheet']}
      canonicalTitle='Prop Hero'
      canonicalPluralTitle='Hero Images'
      sheetTitle='Prop Sheet'
      sheetPluralTitle='Prop Sheets'
      onToggleCanonical={onToggleHero}
      onDeleteAssetFile={onDeleteAssetFile}
    />
  );
}
