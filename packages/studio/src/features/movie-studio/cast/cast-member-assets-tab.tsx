import { VolumeX } from 'lucide-react';
import type {
  CastMemberResourceResponse,
  StudioAssetFileResponse,
} from '@/services/studio-project-contracts';
import { MediaCollectionSection } from '@/ui/media-collection-section';
import {
  continuityImageAspectRatio,
  continuityImageAssetFiles,
  continuityImageUrl,
  continuityPreviewImage,
} from '../continuity/continuity-image-assets';
import { humanizeReferenceName } from './cast-reference-labels';
import { CastVoiceSampleCard } from './cast-voice-sample-card';
import { useGenerationRequestInspectorDialog } from '@/features/media-generation-request/use-media-generation-request-inspector';

interface CastMemberAssetFilesTabProps {
  projectName: string;
  resource: CastMemberResourceResponse;
  assetFiles: StudioAssetFileResponse[];
  selectedProfileAssetFileId: string | null;
  onTogglePick: (assetFile: StudioAssetFileResponse) => Promise<void>;
  onDeleteAssetFile: (assetFile: StudioAssetFileResponse) => Promise<void>;
  onDeleteVoice: (
    voice: CastMemberResourceResponse['voices'][number]
  ) => Promise<void>;
  onSelectDefaultVoice: (
    voice: CastMemberResourceResponse['voices'][number]
  ) => Promise<void>;
}

export function CastMemberAssetFilesTab({
  projectName,
  resource,
  assetFiles,
  selectedProfileAssetFileId,
  onTogglePick,
  onDeleteAssetFile,
  onDeleteVoice,
  onSelectDefaultVoice,
}: CastMemberAssetFilesTabProps) {
  const { openGenerationRequestInspector } = useGenerationRequestInspectorDialog();
  const profileAssetFiles = continuityImageAssetFiles(assetFiles, ['cast_profile']);
  const characterSheetAssetFiles = continuityImageAssetFiles(assetFiles, ['character_sheet']);

  return (
    <div className='min-h-full overflow-y-auto bg-panel-bg px-4 py-5'>
      <div className='space-y-8'>
        <CastAssetFileSection
          title='Profile Images'
          roleLabel='profile image'
          fallbackAspectRatio={1}
          fit='cover'
          minimumCardWidthPx={240}
          projectName={projectName}
          assetFiles={profileAssetFiles}
          selectedAssetFileId={selectedProfileAssetFileId}
          emptyTitle='No profile images yet.'
          onTogglePick={onTogglePick}
          onDeleteAssetFile={onDeleteAssetFile}
        />
        <CastAssetFileSection
          title='Character Sheets'
          roleLabel='character sheet'
          fallbackAspectRatio={4 / 3}
          fit='contain'
          minimumCardWidthPx={384}
          projectName={projectName}
          assetFiles={characterSheetAssetFiles}
          emptyTitle='No character sheets yet.'
          onInspectImage={(assetFile) => {
            openGenerationRequestInspector({
              projectName,
              assetFileId: assetFile.id,
            });
          }}
          onDeleteAssetFile={onDeleteAssetFile}
        />
        <VoiceSamplesSection
          voices={resource.voices}
          onDeleteVoice={onDeleteVoice}
          onSelectDefaultVoice={onSelectDefaultVoice}
        />
      </div>
    </div>
  );
}

function CastAssetFileSection({
  title,
  roleLabel,
  fallbackAspectRatio,
  fit,
  minimumCardWidthPx,
  projectName,
  assetFiles,
  selectedAssetFileId,
  emptyTitle,
  onTogglePick,
  onInspectImage,
  onDeleteAssetFile,
}: {
  title: string;
  roleLabel: string;
  fallbackAspectRatio: number;
  fit: 'cover' | 'contain';
  minimumCardWidthPx: number;
  projectName: string;
  assetFiles: StudioAssetFileResponse[];
  selectedAssetFileId?: string | null;
  emptyTitle: string;
  onTogglePick?: (assetFile: StudioAssetFileResponse) => Promise<void>;
  onInspectImage?: (assetFile: StudioAssetFileResponse) => void;
  onDeleteAssetFile: (assetFile: StudioAssetFileResponse) => Promise<void>;
}) {
  const selectable = Boolean(onTogglePick);
  const items = assetFiles.map((assetFile) => {
    const previewImage = continuityPreviewImage(
      projectName,
      assetFile,
      roleLabel
    );
    const selected = assetFile.id === selectedAssetFileId;
    const imageUrl = continuityImageUrl(projectName, assetFile);
    const title = assetFile.referenceName
      ? humanizeReferenceName(assetFile.referenceName)
      : undefined;
    return {
      id: assetFile.id,
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
          aspectRatio: continuityImageAspectRatio(assetFile, fallbackAspectRatio),
          detectFromImage: true,
        },
        presentation: {
          kind: 'overlay' as const,
          copy:
            title || assetFile.oneLineSummary
              ? {
                  title,
                  description: assetFile.oneLineSummary ?? undefined,
                }
              : undefined,
        },
        activation: previewImage
          ? {
              kind: 'image-preview' as const,
              label: title ?? (selected ? `Current ${roleLabel} pick` : roleLabel),
              image: previewImage,
            }
          : undefined,
        selection:
          selectable && onTogglePick
            ? {
                kind: 'toggle' as const,
                selected,
                selectedLabel: `Clear ${roleLabel} pick`,
                unselectedLabel: `Set ${roleLabel} pick`,
                onToggle: () => onTogglePick(assetFile),
              }
            : undefined,
        cornerAction: onInspectImage
          ? {
              kind: 'inspect' as const,
              label: 'View generation request',
              visibility: 'always' as const,
              onAction: () => onInspectImage(assetFile),
            }
          : undefined,
        deleteAction: {
          label: 'Delete image',
          confirmationTitle: 'Delete Image?',
          confirmationMessage:
            'Remove this image from this cast member. This cannot be undone.',
          onDelete: () => onDeleteAssetFile(assetFile),
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
  onSelectDefaultVoice,
}: {
  voices: CastMemberResourceResponse['voices'];
  onDeleteVoice: (
    voice: CastMemberResourceResponse['voices'][number]
  ) => Promise<void>;
  onSelectDefaultVoice: (
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
              onSelectDefault={onSelectDefaultVoice}
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
