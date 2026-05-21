import { AlertTriangle, Film } from 'lucide-react';
import { Button } from '@/ui/button';
import type { ProjectSummaryWithHttp } from '@/services/studio-project-contracts';

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
    <Button
      type='button'
      variant='ghost'
      disabled={disabled}
      onClick={() => void onSelectProject(project.name)}
      className='group h-auto min-w-0 items-stretch justify-start overflow-hidden whitespace-normal rounded-xl border border-border/40 bg-card p-0 text-left shadow-lg transition-all hover:border-primary/70 hover:bg-card hover:shadow-xl disabled:cursor-not-allowed disabled:opacity-75'
    >
      <div className='min-w-0 flex-1'>
        <div className='aspect-video bg-muted/50 overflow-hidden border-b border-border/40'>
          {project.coverUrl ? (
            <img
              src={project.coverUrl}
              alt=''
              className='h-full w-full object-cover transition-transform group-hover:scale-[1.03]'
            />
          ) : (
            <div className='h-full w-full flex items-center justify-center'>
              <Film className='h-8 w-8 text-muted-foreground' />
            </div>
          )}
        </div>

        <div className='p-3 space-y-2'>
          <div className='flex items-start justify-between gap-2'>
            <div className='min-w-0'>
              <h2 className='line-clamp-2 text-sm font-semibold leading-snug'>
                {project.title}
              </h2>
              <p className='mt-1 truncate text-[11px] text-muted-foreground'>
                {project.name}
              </p>
            </div>
            {project.validationError ? (
              <AlertTriangle className='mt-0.5 h-4 w-4 shrink-0 text-red-600 dark:text-red-300' />
            ) : null}
          </div>

          {project.logline ? (
            <p className='line-clamp-2 text-xs leading-relaxed text-muted-foreground'>
              {project.logline}
            </p>
          ) : null}

          {project.validationError ? (
            <p className='line-clamp-2 text-xs leading-relaxed text-red-700 dark:text-red-300'>
              {project.validationError.code}: {project.validationError.message}
            </p>
          ) : (
            <div className='flex flex-wrap gap-1.5'>
              <ProjectLibraryMetric
                label='Seq'
                value={project.counts?.sequences ?? 0}
              />
              <ProjectLibraryMetric
                label='Scenes'
                value={project.counts?.scenes ?? 0}
              />
            </div>
          )}
        </div>
      </div>
    </Button>
  );
}

function ProjectLibraryMetric({
  label,
  value,
}: {
  label: string;
  value: number;
}) {
  return (
    <span className='rounded-full border border-border/50 bg-muted/50 px-2 py-0.5 text-[10px] text-muted-foreground'>
      {label}: <span className='font-semibold text-foreground'>{value}</span>
    </span>
  );
}
