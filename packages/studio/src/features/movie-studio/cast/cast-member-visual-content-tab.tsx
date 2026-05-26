import { useState } from 'react';
import { ImageOff, Trash2 } from 'lucide-react';
import type { StudioAssetResponse } from '@/services/studio-project-contracts';
import { Button } from '@/ui/button';
import { DeleteConfirmDialog } from '@/ui/delete-confirm-dialog';
import {
  ImagePreviewDialog,
  type PreviewImage,
} from '@/ui/image-preview-dialog';
import { ImageCardGrid } from '@/ui/image-card-grid';
import { ImageOverlayCard } from '@/ui/image-overlay-card';
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
      <div className='min-h-full overflow-y-auto bg-panel-bg p-5 sm:p-8 lg:p-10'>
        <div className='mx-auto max-w-[1240px] space-y-10'>
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
        image={previewImage}
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
  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-end justify-between gap-3 border-b border-border/40 pb-4'>
        <div className='min-w-0'>
          <h2 className='text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
            {title}
          </h2>
        </div>
        <span className='rounded-full border border-border/50 bg-muted/40 px-3 py-1 text-xs font-semibold text-foreground/70'>
          {assets.length === 1 ? '1 image' : `${assets.length} images`}
        </span>
      </div>
      {assets.length ? (
        <ImageCardGrid className={gridClassName}>
          {assets.map((asset) => {
            const previewImage = castPreviewImageForAsset(
              projectName,
              castMemberId,
              asset
            );
            const selected = asset.selection.kind === 'select';
            const imageUrl = castImageAssetUrl(projectName, castMemberId, asset);
            return (
              <ImageOverlayCard
                key={asset.assetId}
                imageUrl={imageUrl}
                imageAlt={selected ? `Current ${roleLabel} pick` : roleLabel}
                aspectClassName={aspectClassName}
                aspectRatio={castImageAssetAspectRatio(
                  asset,
                  fallbackAspectRatio
                )}
                detectImageAspectRatio
                imageClassName={imageClassName}
                selected={selected}
                onOpen={() => previewImage && onOpenImage(previewImage)}
                bottomRightControl={
                  <ImageSelectionControl
                    selected={selected}
                    selectedLabel={`Clear ${roleLabel} pick`}
                    unselectedLabel={`Set ${roleLabel} pick`}
                    onToggleSelected={() => onTogglePick(asset)}
                  />
                }
                topRightAction={
                  <DeleteConfirmDialog
                    title='Delete Image?'
                    message='Remove this image from this cast member. This cannot be undone.'
                    onDelete={() => onDeleteAsset(asset)}
                    trigger={
                      <Button
                        type='button'
                        size='icon'
                        variant='ghost'
                        className='h-7 w-7 text-white/75 hover:bg-destructive/80 hover:text-white'
                        aria-label='Delete image'
                      >
                        <Trash2 className='h-4 w-4' />
                      </Button>
                    }
                  />
                }
              />
            );
          })}
        </ImageCardGrid>
      ) : (
        <CastAssetEmptyState title={emptyTitle} />
      )}
    </section>
  );
}

function CastAssetEmptyState({ title }: { title: string }) {
  return (
    <div className='flex min-h-40 flex-col items-center justify-center rounded-md border border-dashed border-border/50 bg-muted/15 p-6 text-center'>
      <ImageOff className='mb-3 h-5 w-5 text-muted-foreground' />
      <p className='text-sm font-medium text-foreground'>{title}</p>
    </div>
  );
}
