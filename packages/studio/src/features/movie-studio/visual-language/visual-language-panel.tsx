import type { ProjectShellWithHttp } from '@/services/studio-project-contracts';

interface VisualLanguagePanelProps {
  project: ProjectShellWithHttp;
}

export function VisualLanguagePanel({ project }: VisualLanguagePanelProps) {
  return (
    <div className='mx-auto flex max-w-4xl flex-col gap-4'>
      <div className='rounded-md border border-border/40 bg-background/30 p-4'>
        <p className='text-sm text-muted-foreground'>
          Visual Language design for {project.identity.title} will be added here.
        </p>
      </div>
    </div>
  );
}
