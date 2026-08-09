import type { ProjectSummaryWithHttp } from '@/services/studio-project-contracts';
import { MediaCard } from '@/ui/media-card/media-card';

interface ProjectLibraryCardProps {
  project: ProjectSummaryWithHttp;
  isSelectingProject: boolean;
  onSelectProject: (projectName: string) => Promise<void>;
  onDeleteProject: (
    projectName: string,
    confirmationProjectName: string
  ) => Promise<void>;
}

export function ProjectLibraryCard({
  project,
  isSelectingProject,
  onSelectProject,
  onDeleteProject,
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
          subtitle: project.projectName,
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
        kind: 'callback',
        label: project.title,
        disabled,
        onActivate: () => void onSelectProject(project.projectName),
      }}
      deleteAction={{
        label: `Delete ${project.projectName} Project`,
        confirmationTitle: 'Delete Project?',
        confirmationMessage:
          'This permanently deletes every file in this Project. This cannot be undone.',
        confirmation: {
          expectedValue: project.projectName,
          instruction: `Type ${project.projectName} to confirm.`,
          label: 'Project name',
        },
        deleteLabel: 'Delete Project',
        onDelete: async (confirmationProjectName) => {
          if (confirmationProjectName === undefined) {
            throw new Error('Enter the Project name to confirm deletion.');
          }
          await onDeleteProject(project.projectName, confirmationProjectName);
        },
      }}
      emptyState={{ kind: 'film' }}
    />
  );
}
