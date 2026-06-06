import { useState } from 'react';
import type { StudioAssetResponse } from '@/services/studio-project-contracts';
import { ImageCollectionSection } from '@/ui/image-collection-section';
import {
  ImagePreviewDialog,
  type PreviewImage,
} from '@/ui/image-preview-dialog';
import { ImageSelectionControl } from '@/ui/image-selection-control';
import {
  CAST_CHARACTER_SHEET_ROLE,
  CAST_PROFILE_ROLE,
  castImageAssetAspectRatio,
  castImageAssetsForRole,
  castImageAssetUrl,
  castPreviewImageForAsset,
} from './cast-member-assets';

interface CastMemberVisualContentTabProps {
  projectName: string;
  castMemberId: string;
  assets: StudioAssetResponse[];
  onTogglePick: (asset: StudioAssetResponse) => Promise<void>;
  onDeleteAsset: (asset: StudioAssetResponse) => Promise<void>;
}

export function CastMemberVisualContentTab({
  projectName,
  castMemberId,
  assets,
  onTogglePick,
  onDeleteAsset,
}: CastMemberVisualContentTabProps) {
  const [previewImage, setPreviewImage] = useState<PreviewImage | null>(null);
  const profileAssets = castImageAssetsForRole(assets, CAST_PROFILE_ROLE);
  const characterSheetAssets = castImageAssetsForRole(
    assets,
    CAST_CHARACTER_SHEET_ROLE
  );

  return (
    <>
      <div className='min-h-full overflow-y-auto bg-panel-bg px-4 py-5'>
        <div className='space-y-8'>
          <CastAssetSection
            title='Profile Images'
            roleLabel='profile image'
            aspectClassName='aspect-square'
            fallbackAspectRatio={1}
            projectName={projectName}
            castMemberId={castMemberId}
            assets={profileAssets}
            emptyTitle='No profile images yet.'
            gridClassName='grid-cols-[repeat(auto-fill,minmax(240px,1fr))]'
            onOpenImage={setPreviewImage}
            onTogglePick={onTogglePick}
            onDeleteAsset={async (asset) => {
              await onDeleteAsset(asset);
              setPreviewImage((current) =>
                current?.title === asset.title ? null : current
              );
            }}
          />
          <CastAssetSection
            title='Character Sheets'
            roleLabel='character sheet'
            aspectClassName='aspect-[4/3]'
            fallbackAspectRatio={4 / 3}
            imageClassName='object-contain'
            projectName={projectName}
            castMemberId={castMemberId}
            assets={characterSheetAssets}
            emptyTitle='No character sheets yet.'
            gridClassName='grid-cols-[repeat(auto-fill,minmax(480px,1fr))]'
            onOpenImage={setPreviewImage}
            onTogglePick={onTogglePick}
            onDeleteAsset={async (asset) => {
              await onDeleteAsset(asset);
              setPreviewImage((current) =>
                current?.title === asset.title ? null : current
              );
            }}
          />
        </div>
      </div>
      <ImagePreviewDialog
        images={previewImage ? [previewImage] : []}
        currentIndex={0}
        onOpenChange={(open) => !open && setPreviewImage(null)}
      />
    </>
  );
}

function CastAssetSection({
  title,
  roleLabel,
  aspectClassName,
  fallbackAspectRatio,
  imageClassName,
  gridClassName,
  projectName,
  castMemberId,
  assets,
  emptyTitle,
  onOpenImage,
  onTogglePick,
  onDeleteAsset,
}: {
  title: string;
  roleLabel: string;
  aspectClassName: string;
  fallbackAspectRatio: number;
  imageClassName?: string;
  gridClassName: string;
  projectName: string;
  castMemberId: string;
  assets: StudioAssetResponse[];
  emptyTitle: string;
  onOpenImage: (image: PreviewImage) => void;
  onTogglePick: (asset: StudioAssetResponse) => Promise<void>;
  onDeleteAsset: (asset: StudioAssetResponse) => Promise<void>;
}) {
  const items = assets.map((asset) => {
    const previewImage = castPreviewImageForAsset(
      projectName,
      castMemberId,
      asset
    );
    const selected = asset.selection.kind === 'select';
    const imageUrl = castImageAssetUrl(projectName, castMemberId, asset);
    return {
      id: asset.assetId,
      imageUrl,
      imageAlt: selected ? `Current ${roleLabel} pick` : roleLabel,
      aspectClassName,
      aspectRatio: castImageAssetAspectRatio(asset, fallbackAspectRatio),
      detectImageAspectRatio: true,
      imageClassName,
      selected,
      onOpen: () => previewImage && onOpenImage(previewImage),
      bottomRightControl: (
        <ImageSelectionControl
          selected={selected}
          selectedLabel={`Clear ${roleLabel} pick`}
          unselectedLabel={`Set ${roleLabel} pick`}
          onToggleSelected={() => onTogglePick(asset)}
        />
      ),
      deleteAction: {
        label: 'Delete image',
        title: 'Delete Image?',
        message: 'Remove this image from this cast member. This cannot be undone.',
        onDelete: () => onDeleteAsset(asset),
      },
    };
  });

  return (
    <ImageCollectionSection
      title={title}
      emptyTitle={emptyTitle}
      items={items}
      gridClassName={gridClassName}
    />
  );
}
