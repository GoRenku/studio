import type { StudioAssetFileResponse } from '@/services/studio-project-contracts';
import { propMediaRequest } from '../agent-request-copy';
import { ContinuityImageAssetFilesTab } from '../continuity/continuity-image-assets-tab';

export function PropAssetFilesTab({
  projectName,
  propName,
  assetFiles,
  selectedHeroAssetFileId,
  onToggleHero,
  onDeleteAssetFile,
}: {
  projectName: string;
  propName: string;
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
      emptyRequest={propMediaRequest(propName)}
      sheetPluralTitle='Prop Sheets'
      onToggleCanonical={onToggleHero}
      onDeleteAssetFile={onDeleteAssetFile}
    />
  );
}
