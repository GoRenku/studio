import { useState } from 'react';
import { VolumeX } from 'lucide-react';
import type {
  CastMemberResourceResponse,
  StudioAssetResponse,
} from '@/services/studio-project-contracts';
import { ImageCollectionSection } from '@/ui/image-collection-section';
import { ImageCardGrid } from '@/ui/image-card-grid';
import {
  ImagePreviewDialog,
  type PreviewImage,
} from '@/ui/image-preview-dialog';
import { ImageSelectionControl } from '@/ui/image-selection-control';
import {
  CAST_CHARACTER_SHEET_ROLES,
  CAST_PROFILE_ROLE,
  castImageAssetAspectRatio,
  castImageAssetsForRole,
  castImageAssetsForRoles,
  castImageAssetUrl,
  castPreviewImageForAsset,
} from './cast-member-assets';
import { humanizeReferenceName } from './cast-reference-labels';
import { CastVoiceSampleCard } from './cast-voice-sample-card';
import { ImageRevisionCardAction } from '@/features/image-revision/image-revision-card-action';
import { useImageRevisionDialog } from '@/features/image-revision/use-image-revision-dialog';

interface CastMemberAssetsTabProps {
  projectName: string;
  castMemberId: string;
  resource: CastMemberResourceResponse;
  assets: StudioAssetResponse[];
  onTogglePick: (asset: StudioAssetResponse) => Promise<void>;
  onDeleteAsset: (asset: StudioAssetResponse) => Promise<void>;
  onDeleteVoice: (
    voice: CastMemberResourceResponse['voices'][number]
  ) => Promise<void>;
}

export function CastMemberAssetsTab({
  projectName,
  castMemberId,
  resource,
  assets,
  onTogglePick,
  onDeleteAsset,
  onDeleteVoice,
}: CastMemberAssetsTabProps) {
  const [previewImage, setPreviewImage] = useState<PreviewImage | null>(null);
  const { openImageRevision } = useImageRevisionDialog();
  const profileAssets = castImageAssetsForRole(assets, CAST_PROFILE_ROLE);
  const characterSheetAssets = castImageAssetsForRoles(
    assets,
    CAST_CHARACTER_SHEET_ROLES
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
            gridClassName='grid-cols-[repeat(auto-fill,minmax(384px,1fr))]'
            onOpenImage={setPreviewImage}
            onEditImage={(asset) => {
              const file = asset.files.find(
                (candidate) => candidate.mediaKind === 'image'
              );
              if (!file) return;
              openImageRevision({
                projectName,
                target: {
                  kind: 'castCharacterSheet',
                  castMemberId,
                  assetId: asset.assetId,
                  assetFileId: file.id,
                },
              });
            }}
            onDeleteAsset={async (asset) => {
              await onDeleteAsset(asset);
              setPreviewImage((current) =>
                current?.title === asset.title ? null : current
              );
            }}
          />
          <VoiceSamplesSection
            voices={resource.voices}
            onDeleteVoice={onDeleteVoice}
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
  onEditImage,
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
  onTogglePick?: (asset: StudioAssetResponse) => Promise<void>;
  onEditImage?: (asset: StudioAssetResponse) => void;
  onDeleteAsset: (asset: StudioAssetResponse) => Promise<void>;
}) {
  const selectable = Boolean(onTogglePick);
  const items = assets.map((asset) => {
    const previewImage = castPreviewImageForAsset(
      projectName,
      castMemberId,
      asset
    );
    const selected = asset.selection.kind === 'select';
    const imageUrl = castImageAssetUrl(projectName, castMemberId, asset);
    const title = asset.referenceName
      ? humanizeReferenceName(asset.referenceName)
      : undefined;
    return {
      id: asset.assetId,
      imageUrl,
      imageAlt: selected ? `Current ${roleLabel} pick` : roleLabel,
      title,
      description: asset.purpose ?? undefined,
      aspectClassName,
      aspectRatio: castImageAssetAspectRatio(asset, fallbackAspectRatio),
      detectImageAspectRatio: true,
      imageClassName,
      selected: selectable ? selected : false,
      onOpen: () => previewImage && onOpenImage(previewImage),
      bottomRightActions:
        selectable || onEditImage ? (
          <>
            {selectable && onTogglePick ? (
              <ImageSelectionControl
                selected={selected}
                selectedLabel={`Clear ${roleLabel} pick`}
                unselectedLabel={`Set ${roleLabel} pick`}
                onToggleSelected={() => onTogglePick(asset)}
              />
            ) : null}
            {onEditImage ? (
              <ImageRevisionCardAction onEdit={() => onEditImage(asset)} />
            ) : null}
          </>
        ) : undefined,
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

function VoiceSamplesSection({
  voices,
  onDeleteVoice,
}: {
  voices: CastMemberResourceResponse['voices'];
  onDeleteVoice: (
    voice: CastMemberResourceResponse['voices'][number]
  ) => Promise<void>;
}) {
  return (
    <section className='space-y-4'>
      <div className='flex flex-wrap items-end justify-between gap-3 border-b border-border/40 pb-4'>
        <div className='min-w-0'>
          <h2 className='text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
            Voice Samples
          </h2>
        </div>
        <span className='rounded-full border border-border/50 bg-muted/40 px-3 py-1 text-xs font-semibold text-foreground/70'>
          {voices.length === 1 ? '1 sample' : `${voices.length} samples`}
        </span>
      </div>
      {voices.length ? (
        <ImageCardGrid className='grid-cols-[repeat(auto-fill,minmax(320px,1fr))]'>
          {voices.map((voice) => (
            <CastVoiceSampleCard
              key={voice.id}
              voice={voice}
              onDelete={onDeleteVoice}
            />
          ))}
        </ImageCardGrid>
      ) : (
        <div className='flex min-h-40 flex-col items-center justify-center rounded-md border border-dashed border-border/50 bg-muted/15 p-6 text-center'>
          <VolumeX className='mb-3 h-5 w-5 text-muted-foreground' />
          <p className='text-sm font-medium text-foreground'>
            No voice samples yet.
          </p>
        </div>
      )}
    </section>
  );
}
