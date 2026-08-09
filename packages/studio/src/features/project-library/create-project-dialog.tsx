import { useState, type FormEvent } from 'react';
import { Info, Loader2, Plus } from 'lucide-react';
import { createProject } from '@/services/studio-projects-api';
import { StudioApiError } from '@/services/studio-api-errors';
import { Alert, AlertDescription } from '@/ui/alert';
import { Button } from '@/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/ui/dialog';
import { Input } from '@/ui/input';
import { suggestProjectName } from './project-name-suggestion';

interface CreateProjectDialogProps {
  storageRoot: string;
  onCreated: (projectName: string) => Promise<void>;
}

const PROJECT_NAME_PATTERN = /^[a-z0-9]+(?:-[a-z0-9]+)*$/;

export function CreateProjectDialog({
  storageRoot,
  onCreated,
}: CreateProjectDialogProps) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [projectName, setProjectName] = useState('');
  const [projectNameCustomized, setProjectNameCustomized] = useState(false);
  const [titleTouched, setTitleTouched] = useState(false);
  const [projectNameTouched, setProjectNameTouched] = useState(false);
  const [titleServerError, setTitleServerError] = useState<string | null>(null);
  const [projectNameServerError, setProjectNameServerError] = useState<string | null>(null);
  const [globalError, setGlobalError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);

  const titleValid = title.trim() !== '';
  const projectNameValid = PROJECT_NAME_PATTERN.test(projectName);
  const titleError = titleServerError ?? (
    titleTouched && !titleValid ? 'Enter a Project title.' : null
  );
  const projectNameError = projectNameServerError ?? (
    projectNameTouched && !projectNameValid
      ? 'Use lowercase letters, numbers, and single hyphens only.'
      : null
  );
  const location = projectNameValid
    ? `${storageRoot.replace(/\/+$/, '')}/${projectName}`
    : storageRoot;

  const resetDraft = () => {
    setTitle('');
    setProjectName('');
    setProjectNameCustomized(false);
    setTitleTouched(false);
    setProjectNameTouched(false);
    setTitleServerError(null);
    setProjectNameServerError(null);
    setGlobalError(null);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (creating) {
      return;
    }
    if (!nextOpen) {
      resetDraft();
    }
    setOpen(nextOpen);
  };

  const handleTitleChange = (value: string) => {
    setTitle(value);
    setTitleServerError(null);
    setGlobalError(null);
    if (!projectNameCustomized) {
      setProjectName(suggestProjectName(value));
      setProjectNameServerError(null);
    }
  };

  const handleProjectNameChange = (value: string) => {
    setProjectName(value);
    setProjectNameCustomized(true);
    setProjectNameServerError(null);
    setGlobalError(null);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setTitleTouched(true);
    setProjectNameTouched(true);
    setTitleServerError(null);
    setProjectNameServerError(null);
    setGlobalError(null);
    if (!titleValid || !projectNameValid || creating) {
      return;
    }

    setCreating(true);
    let createdProjectName: string;
    try {
      const report = await createProject({ projectName, title });
      createdProjectName = report.projectName;
    } catch (error) {
      projectCreationError(error, {
        title: setTitleServerError,
        projectName: setProjectNameServerError,
        global: setGlobalError,
      });
      setCreating(false);
      return;
    }
    resetDraft();
    setOpen(false);
    setCreating(false);
    await onCreated(createdProjectName);
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button type='button' size='sm' className='gap-2 shadow-sm'>
          <Plus className='h-3.5 w-3.5' />
          Create Project
        </Button>
      </DialogTrigger>
      <DialogContent
        className='max-w-[570px] gap-0 overflow-hidden p-0'
        showCloseButton={!creating}
        onEscapeKeyDown={(event) => creating && event.preventDefault()}
        onPointerDownOutside={(event) => creating && event.preventDefault()}
      >
        <form onSubmit={submit}>
          <DialogHeader className='gap-2 px-7 py-6'>
            <DialogTitle className='text-lg font-semibold normal-case leading-tight tracking-normal'>
              Create project
            </DialogTitle>
            <DialogDescription className='max-w-[440px] leading-5'>
              Start with an empty Renku project. You can create or import a screenplay later.
            </DialogDescription>
          </DialogHeader>

          <div className='space-y-5 px-7 py-6'>
            {globalError ? (
              <Alert variant='destructive'>
                <AlertDescription>{globalError}</AlertDescription>
              </Alert>
            ) : null}

            <div className='space-y-2'>
              <label htmlFor='create-project-title' className='text-sm font-medium'>
                Project title <span aria-hidden='true'>*</span>
              </label>
              <Input
                id='create-project-title'
                autoFocus
                required
                value={title}
                disabled={creating}
                aria-invalid={Boolean(titleError)}
                aria-describedby={titleError ? 'create-project-title-error' : undefined}
                onBlur={() => setTitleTouched(true)}
                onChange={(event) => handleTitleChange(event.currentTarget.value)}
                placeholder='The Glass Harbor'
                className='h-10 focus-visible:border-primary focus-visible:ring-primary/45'
              />
              {titleError ? (
                <p id='create-project-title-error' className='text-xs text-destructive'>
                  {titleError}
                </p>
              ) : null}
            </div>

            <div className='space-y-2'>
              <label htmlFor='create-project-folder-name' className='text-sm font-medium'>
                Folder name <span aria-hidden='true'>*</span>
              </label>
              <Input
                id='create-project-folder-name'
                required
                value={projectName}
                disabled={creating}
                aria-invalid={Boolean(projectNameError)}
                aria-describedby={
                  projectNameError
                    ? 'create-project-folder-help create-project-folder-error'
                    : 'create-project-folder-help'
                }
                onBlur={() => setProjectNameTouched(true)}
                onChange={(event) => handleProjectNameChange(event.currentTarget.value)}
                placeholder='the-glass-harbor'
                className='h-10 focus-visible:border-primary focus-visible:ring-primary/45'
              />
              <p id='create-project-folder-help' className='text-xs leading-5 text-muted-foreground'>
                Automatically suggested from the Project title. You can edit it.
              </p>
              {projectNameError ? (
                <p id='create-project-folder-error' className='text-xs text-destructive'>
                  {projectNameError}
                </p>
              ) : null}
            </div>

            <div className='space-y-2'>
              <p className='text-sm font-medium'>Location</p>
              <p className='break-all text-sm leading-5 text-muted-foreground'>{location}</p>
            </div>

            <div className='flex gap-3 border-t border-border/50 pt-5 text-xs leading-5 text-muted-foreground'>
              <Info className='mt-0.5 h-4 w-4 shrink-0' />
              <p>Renku will create the Project folder and initialize its database.</p>
            </div>
          </div>

          <DialogFooter className='px-7 py-6'>
            <Button
              type='button'
              variant='outline'
              disabled={creating}
              className='h-10'
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type='submit'
              disabled={creating || !titleValid || !projectNameValid}
              className='h-10 min-w-[128px] gap-2'
            >
              {creating ? <Loader2 className='h-4 w-4 animate-spin' /> : null}
              {creating ? 'Creating…' : 'Create project'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}

function projectCreationError(
  error: unknown,
  setters: {
    title: (message: string | null) => void;
    projectName: (message: string | null) => void;
    global: (message: string | null) => void;
  }
): void {
  if (error instanceof StudioApiError) {
    const titleIssue = error.issues.find(
      (issue) => issue.severity === 'error' && issue.location.path[0] === 'title'
    );
    const projectNameIssue = error.issues.find(
      (issue) => issue.severity === 'error' && issue.location.path[0] === 'projectName'
    );
    if (titleIssue || projectNameIssue) {
      setters.title(titleIssue?.message ?? null);
      setters.projectName(projectNameIssue?.message ?? null);
      return;
    }
  }
  setters.global(error instanceof Error ? error.message : 'Project creation failed.');
}
