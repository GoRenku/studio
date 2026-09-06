import type { ProjectSupportingFile } from '@gorenku/studio-core/client';
import { MediaCard } from '@/ui/media-card/media-card';
import { MediaCardGrid } from '@/ui/media-card/media-card-grid';
import { openSupportingFileTab } from '@/services/supporting-files';
import type { MediaCardMedia } from '@/ui/media-card/media-card-contract';

export function SupportingFileCards({ projectName, files, onInspect, onDelete }: {
  projectName: string;
  files: ProjectSupportingFile[];
  onInspect: (file: ProjectSupportingFile) => void;
  onDelete: (file: ProjectSupportingFile) => Promise<void>;
}) {
  return (
    <MediaCardGrid minimumCardWidthPx={240} gap='standard'>
      {files.map((file) => (
        <MediaCard
          key={file.asset.id}
          media={supportingFileMedia(projectName, file)}
          frame={{ kind: 'ratio', aspectRatio: 13 / 8 }}
          presentation={{ kind: 'overlay', copy: { title: file.asset.title, titleTreatment: 'filename' } }}
          activation={{
            kind: 'callback', label: `Open ${file.asset.title}`,
            onActivate: () => openSupportingFileTab(projectName, file.asset.id),
          }}
          cornerAction={{ kind: 'info', label: `File information: ${file.asset.title}`, visibility: 'always', onAction: () => onInspect(file) }}
          deleteAction={file.deleteBlock ? undefined : {
            label: `Move ${file.asset.title} to Trash`,
            confirmationTitle: 'Move supporting file to Trash?',
            confirmationMessage: 'This file can be restored from Trash. Its external original and screenplay content will remain unchanged.',
            deleteLabel: 'Move to Trash',
            onDelete: () => onDelete(file),
          }}
        />
      ))}
    </MediaCardGrid>
  );
}

function supportingFileMedia(projectName: string, file: ProjectSupportingFile): MediaCardMedia {
  const source = file.asset.files.find((candidate) => candidate.id === file.sourceAssetFileId)!;
  const filename = source.projectRelativePath;
  const extension = filename.includes('.') ? filename.split('.').at(-1)!.toUpperCase() : '';
  const src = `/studio-api/projects/${encodeURIComponent(projectName)}/supporting-files/${encodeURIComponent(file.asset.id)}/content`;
  if (['PNG', 'JPG', 'JPEG', 'WEBP', 'GIF'].includes(extension)) {
    return { kind: 'image', src, alt: file.asset.title, fit: 'cover', loading: 'lazy', effect: 'zoom-on-hover' };
  }
  if (['MP4', 'WEBM'].includes(extension)) {
    return { kind: 'video', src, title: file.asset.title, playback: 'hover-muted' };
  }
  return { kind: 'document', extension };
}
