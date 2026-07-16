import type { ProjectSummaryWithHttp } from '@/services/studio-project-contracts';
import { MediaCard } from '@/ui/media-card/media-card';

interface ProjectLibraryCardProps {
  project: ProjectSummaryWithHttp;
  isSelectingProject: boolean;
  onSelectProject: (projectName: string) => Promise<void>;
}

export function ProjectLibraryCard({
  project,
  isSelectingProject,
  onSelectProject,
}: ProjectLibraryCardProps) {
  const disabled = isSelectingProject || Boolean(project.validationError);

  return (
    <MediaCard
      media={
        project.coverUrl
          ? {
              kind: 'image',
              src: project.coverUrl,
              alt: '',
              fit: 'cover',
              effect: 'zoom-on-hover',
            }
          : null
      }
      frame={{ kind: 'ratio', aspectRatio: 16 / 9 }}
      presentation={{
        kind: 'summary',
        body: {
          title: project.title,
          subtitle: project.name,
          description: project.logline,
          issue: project.validationError
            ? {
                code: project.validationError.code,
                message: project.validationError.message,
              }
            : undefined,
          metrics: project.validationError
            ? undefined
            : [
                { label: 'Seq', value: project.counts?.sequences ?? 0 },
                { label: 'Scenes', value: project.counts?.scenes ?? 0 },
              ],
        },
      }}
      activation={{
        label: project.title,
        disabled,
        onActivate: () => void onSelectProject(project.name),
      }}
      emptyState={{ kind: 'film' }}
    />
  );
}
