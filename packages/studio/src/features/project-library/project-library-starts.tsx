import type { ReactNode } from 'react';
import { AgentPrompt } from './agent-prompt';
import { CreateProjectDialog } from './create-project-dialog';
import { SampleFilmLeadStart, type SampleFilmStartController } from './sample-film-start';

const IMPORT_SCREENPLAY_PROMPT =
  'Create a new Renku project called "[project title]" and import the Final Draft screenplay at [full path to your .fdx file].';
const WRITE_SCENE_PROMPT =
  'Create a new Renku project and write a one-page scene about [your idea].';

export function ProjectLibraryStarts({
  storageRoot,
  sampleFilm,
  onCreated,
}: {
  storageRoot: string;
  sampleFilm: SampleFilmStartController;
  onCreated: (projectName: string) => Promise<void>;
}) {
  return (
    <div className='m-auto w-full max-w-[1040px]'>
      <h2 className='text-xl font-semibold tracking-[0.01em]'>Start your first film</h2>
      <p className='mt-1.5 text-sm text-muted-foreground'>
        Your Project Library is empty. Pick one way in.
      </p>
      <div className='mt-6'>
        <SampleFilmLeadStart controller={sampleFilm} />
      </div>
      <div className='mt-4 grid grid-cols-3 gap-4'>
        <SecondaryStart
          title='Start an empty project'
          description='Name your film and begin from a clean project. Bring in a screenplay or write one whenever you are ready.'
        >
          <CreateProjectDialog
            storageRoot={storageRoot}
            onCreated={onCreated}
            triggerVariant='outline'
            triggerClassName='w-full'
          />
        </SecondaryStart>
        <SecondaryStart
          title='Import a screenplay'
          description='Copy this request into your agent. It creates the project and imports the screenplay.'
        >
          <AgentPrompt label='Screenplay import request' prompt={IMPORT_SCREENPLAY_PROMPT} />
        </SecondaryStart>
        <SecondaryStart
          title='Write a scene with your agent'
          description='Describe an idea; your agent creates the project and drafts a one-page scene.'
        >
          <AgentPrompt label='Scene writing request' prompt={WRITE_SCENE_PROMPT} />
        </SecondaryStart>
      </div>
    </div>
  );
}

function SecondaryStart({
  title,
  description,
  children,
}: {
  title: string;
  description: string;
  children: ReactNode;
}) {
  return (
    <section className='flex flex-col gap-3.5 rounded-xl border border-border/40 bg-card/55 p-6'>
      <h3 className='text-[15px] font-semibold'>{title}</h3>
      <p className='text-[13px] leading-relaxed text-muted-foreground'>{description}</p>
      <div className='mt-auto'>{children}</div>
    </section>
  );
}
