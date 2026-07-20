import { useState } from 'react';
import { VolumeX } from 'lucide-react';
import type {
  CastMemberResourceResponse,
  StudioAssetResponse,
} from '@/services/studio-project-contracts';
import { MediaCollectionSection } from '@/ui/media-collection-section';
import {
  ImagePreviewDialog,
  type PreviewImage,
} from '@/ui/image-preview-dialog';
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
import { useGenerationRequestInspectorDialog } from '@/features/generation-request-inspector/use-generation-request-inspector';

interface CastMemberAssetsTabProps {
  projectName: string;
  castMemberId: string;
  resource: CastMemberResourceResponse;
  assets: StudioAssetResponse[];
  displayProfileAssetId: string | null;
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
  displayProfileAssetId,
  onTogglePick,
  onDeleteAsset,
  onDeleteVoice,
}: CastMemberAssetsTabProps) {
  const [previewImage, setPreviewImage] = useState<PreviewImage | null>(null);
  const { openGenerationRequestInspector } = useGenerationRequestInspectorDialog();
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
            fallbackAspectRatio={1}
            fit='cover'
            minimumCardWidthPx={240}
            projectName={projectName}
            castMemberId={castMemberId}
            assets={profileAssets}
            selectedAssetId={displayProfileAssetId}
            emptyTitle='No profile images yet.'
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
            fallbackAspectRatio={4 / 3}
            fit='contain'
            minimumCardWidthPx={384}
            projectName={projectName}
            castMemberId={castMemberId}
            assets={characterSheetAssets}
            emptyTitle='No character sheets yet.'
            onOpenImage={setPreviewImage}
            onInspectImage={(asset) => {
              const file = asset.files.find(
                (candidate) => candidate.mediaKind === 'image'
              );
              if (!file) return;
              openGenerationRequestInspector({
                projectName,
                assetId: asset.assetId,
                assetFileId: file.id,
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
  fallbackAspectRatio,
  fit,
  minimumCardWidthPx,
  projectName,
  castMemberId,
  assets,
  selectedAssetId,
  emptyTitle,
  onOpenImage,
  onTogglePick,
  onInspectImage,
  onDeleteAsset,
}: {
  title: string;
  roleLabel: string;
  fallbackAspectRatio: number;
  fit: 'cover' | 'contain';
  minimumCardWidthPx: number;
  projectName: string;
  castMemberId: string;
  assets: StudioAssetResponse[];
  selectedAssetId?: string | null;
  emptyTitle: string;
  onOpenImage: (image: PreviewImage) => void;
  onTogglePick?: (asset: StudioAssetResponse) => Promise<void>;
  onInspectImage?: (asset: StudioAssetResponse) => void;
  onDeleteAsset: (asset: StudioAssetResponse) => Promise<void>;
}) {
  const selectable = Boolean(onTogglePick);
  const items = assets.map((asset) => {
    const previewImage = castPreviewImageForAsset(
      projectName,
      castMemberId,
      asset
    );
    const selected = asset.assetId === selectedAssetId;
    const imageUrl = castImageAssetUrl(projectName, castMemberId, asset);
    const title = asset.referenceName
      ? humanizeReferenceName(asset.referenceName)
      : undefined;
    return {
      id: asset.assetId,
      card: {
        media: imageUrl
          ? {
              kind: 'image' as const,
              src: imageUrl,
              alt: selected ? `Current ${roleLabel} pick` : roleLabel,
              fit,
              effect: 'zoom-on-hover' as const,
            }
          : null,
        frame: {
          kind: 'ratio' as const,
          aspectRatio: castImageAssetAspectRatio(asset, fallbackAspectRatio),
          detectFromImage: true,
        },
        presentation: {
          kind: 'overlay' as const,
          copy:
            title || asset.purpose
              ? {
                  title,
                  description: asset.purpose ?? undefined,
                }
              : undefined,
        },
        activation: {
          label: title ?? (selected ? `Current ${roleLabel} pick` : roleLabel),
          onActivate: () => {
            if (previewImage) {
              onOpenImage(previewImage);
            }
          },
        },
        selection:
          selectable && onTogglePick
            ? {
                selected,
                selectedLabel: `Clear ${roleLabel} pick`,
                unselectedLabel: `Set ${roleLabel} pick`,
                onToggle: () => onTogglePick(asset),
              }
            : undefined,
        inspectionAction: onInspectImage
          ? {
              label: 'View generation request',
              onInspect: () => onInspectImage(asset),
            }
          : undefined,
        deleteAction: {
          label: 'Delete image',
          confirmationTitle: 'Delete Image?',
          confirmationMessage:
            'Remove this image from this cast member. This cannot be undone.',
          onDelete: () => onDeleteAsset(asset),
        },
        emptyState: { kind: 'image' as const },
      },
    };
  });

  return (
    <MediaCollectionSection
      title={title}
      emptyTitle={emptyTitle}
      items={items}
      minimumCardWidthPx={minimumCardWidthPx}
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
        <div
          className='grid gap-3'
          style={{
            gridTemplateColumns: 'repeat(auto-fill, minmax(320px, 1fr))',
          }}
        >
          {voices.map((voice) => (
            <CastVoiceSampleCard
              key={voice.id}
              voice={voice}
              onDelete={onDeleteVoice}
            />
          ))}
        </div>
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
