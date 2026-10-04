import type { StudioAssetFileResponse } from '@/services/studio-project-contracts';
import { ContinuityImageAssetFilesTab } from '../continuity/continuity-image-assets-tab';

interface LocationVisualContentTabProps {
  projectName: string;
  assetFiles: StudioAssetFileResponse[];
  selectedHeroAssetFileId: string | null;
  onToggleHeroDisplay: (assetFile: StudioAssetFileResponse) => Promise<void>;
  onDeleteAssetFile: (assetFile: StudioAssetFileResponse) => Promise<void>;
}

export function LocationVisualContentTab({
  projectName,
  assetFiles,
  selectedHeroAssetFileId,
  onToggleHeroDisplay,
  onDeleteAssetFile,
}: LocationVisualContentTabProps) {
  return (
    <ContinuityImageAssetFilesTab
      projectName={projectName}
      assetFiles={assetFiles}
      selectedCanonicalAssetFileId={selectedHeroAssetFileId}
      canonicalType='location_hero'
      sheetTypes={['location_sheet']}
      canonicalTitle='Location Hero'
      canonicalPluralTitle='Hero Images'
      sheetTitle='Location Sheet'
      sheetPluralTitle='Location Sheets'
      onToggleCanonical={onToggleHeroDisplay}
      onDeleteAssetFile={onDeleteAssetFile}
    />
  );
}
