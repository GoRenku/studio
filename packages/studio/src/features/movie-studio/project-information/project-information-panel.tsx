import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { SUPPORTED_PROJECT_LOCALES } from '@gorenku/studio-core/client';
import type { ProjectShellWithHttp } from '@/services/studio-project-contracts';
import {
  patchProjectInformation,
  readProject,
  readProjectInformationResource,
} from '@/services/studio-projects-api';
import {
  useDebouncedAutosave,
  type DebouncedSaveStatus,
} from '@/hooks/use-debounced-autosave';
import {
  matchesProjectInformationResource,
  useStudioResourceRefresh,
} from '@/hooks/use-studio-resource-refresh';
import { Input } from '@/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/select';
import { Textarea } from '@/ui/textarea';
import { cn } from '@/lib/utils';
import {
  projectInformationDraftSignature,
  projectInformationDraftToPatch,
  projectInformationIdentitySignature,
  projectShellToInformationResource,
  toProjectInformationDraft,
  type ProjectInformationDraft,
  type ProjectInformationDraftResource,
} from './project-information-draft';

const ASPECT_RATIOS = ['1:1', '3:4', '4:3', '16:9', '9:16', '21:9'] as const;

const projectInformationControlClassName =
  'border-border/55 bg-background/45 shadow-none transition-colors hover:border-primary/45 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/20';

const projectInformationSectionHeadingClassName =
  'text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground';

interface ProjectInformationPanelProps {
  project: ProjectShellWithHttp;
  onProjectChange: (project: ProjectShellWithHttp) => void;
  onSaveStatusChange: (status: DebouncedSaveStatus) => void;
}

export function ProjectInformationPanel({
  project,
  onProjectChange,
  onSaveStatusChange,
}: ProjectInformationPanelProps) {
  const projectResource = useMemo(
    () => projectShellToInformationResource(project),
    [project]
  );
  const projectDraft = useMemo(
    () => toProjectInformationDraft(projectResource),
    [projectResource]
  );
  const [draft, setDraft] = useState<ProjectInformationDraft>(() => projectDraft);
  const [resourceRevision, setResourceRevision] = useState(0);
  const draftRef = useRef(draft);
  const persistedResourceRef = useRef<ProjectInformationDraftResource>(projectResource);
  const lastProjectDraftRef = useRef(projectDraft);
  const lastProjectDraftSignatureRef = useRef(
    projectInformationDraftSignature(projectDraft)
  );

  useEffect(() => {
    draftRef.current = draft;
  }, [draft]);

  const save = useCallback(
    async (nextDraft: ProjectInformationDraft) => {
      const patch = projectInformationDraftToPatch(
        persistedResourceRef.current,
        nextDraft
      );
      const resource = await patchProjectInformation(
        project.project.projectName,
        patch
      );
      persistedResourceRef.current = resource;
      return resource;
    },
    [project.project.projectName]
  );
  const isAutosaveReady = useCallback(
    (nextDraft: ProjectInformationDraft) =>
      Object.keys(
        projectInformationDraftToPatch(persistedResourceRef.current, nextDraft)
      ).length > 0,
    []
  );

  const autosave = useDebouncedAutosave({
    value: draft,
    save,
    failureMessage: 'Project information could not be saved.',
    onSaved: () => {
      void readProject(project.project.projectName).then(onProjectChange);
    },
    isReady: isAutosaveReady,
  });

  useEffect(() => {
    let cancelled = false;
    const requestedProjectDraftSignature =
      projectInformationDraftSignature(projectDraft);
    const requestedProjectIdentitySignature =
      projectInformationIdentitySignature(projectDraft);
    void readProjectInformationResource(project.project.projectName)
      .then((nextResource) => {
        const nextResourceDraft = toProjectInformationDraft(nextResource);
        if (
          cancelled ||
          lastProjectDraftSignatureRef.current !== requestedProjectDraftSignature ||
          projectInformationIdentitySignature(nextResourceDraft) !==
            requestedProjectIdentitySignature
        ) {
          return;
        }
        persistedResourceRef.current = nextResource;
        setDraft((current) =>
          projectInformationDraftSignature(current) ===
          projectInformationDraftSignature(lastProjectDraftRef.current)
            ? nextResourceDraft
            : current
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [project.project.projectName, projectDraft, resourceRevision]);

  useStudioResourceRefresh({
    projectName: project.project.projectName,
    matches: matchesProjectInformationResource,
    onRefresh: () => setResourceRevision((current) => current + 1),
  });

  useEffect(() => {
    onSaveStatusChange(autosave);
  }, [autosave, onSaveStatusChange]);

  useEffect(() => {
    const previousProjectDraft = lastProjectDraftRef.current;
    const currentDraft = draftRef.current;
    const nextProjectDraftSignature = projectInformationDraftSignature(projectDraft);

    lastProjectDraftRef.current = projectDraft;
    lastProjectDraftSignatureRef.current = nextProjectDraftSignature;

    if (
      projectInformationDraftSignature(currentDraft) ===
      projectInformationDraftSignature(previousProjectDraft)
    ) {
      persistedResourceRef.current = projectResource;
      setDraft(projectDraft);
    }
  }, [projectDraft, projectResource]);

  return (
    <div className='mx-auto flex w-full max-w-4xl flex-col px-1 pb-6'>
      <section className='grid gap-6 border-b border-border/35 pb-6 sm:grid-cols-2'>
        <ProjectMetadata
          label='Project Name'
          value={project.project.projectName}
        />
        <ProjectMetadata label='Type' value='Movie' />
      </section>

      <section className='py-6'>
        <div className='grid gap-5'>
          <div className='grid gap-5 lg:grid-cols-[minmax(0,1fr)_180px]'>
            <Field label='Title'>
              <Input
                value={draft.title}
                onChange={(event) =>
                  setDraft((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                className={projectInformationControlClassName}
              />
            </Field>
            <Field label='Aspect Ratio'>
              <Select
                value={draft.aspectRatio}
                onValueChange={(aspectRatio) =>
                  setDraft((current) => ({ ...current, aspectRatio }))
                }
              >
                <SelectTrigger
                  aria-label='Aspect Ratio'
                  className={cn('w-full', projectInformationControlClassName)}
                >
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {ASPECT_RATIOS.map((aspectRatio) => (
                    <SelectItem key={aspectRatio} value={aspectRatio}>
                      {aspectRatio}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </div>

          <Field label='Logline'>
            <Textarea
              value={draft.logline}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  logline: event.target.value,
                }))
              }
              className={cn('min-h-20', projectInformationControlClassName)}
            />
          </Field>

          <Field label='Synopsis'>
            <Textarea
              value={draft.synopsis}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  synopsis: event.target.value,
                }))
              }
              className={cn('min-h-32', projectInformationControlClassName)}
            />
          </Field>

          <Field label='Premise'>
            <Textarea
              value={draft.premise}
              onChange={(event) =>
                setDraft((current) => ({
                  ...current,
                  premise: event.target.value,
                }))
              }
              className={cn('min-h-20', projectInformationControlClassName)}
            />
          </Field>
        </div>
      </section>

      <section className='border-t border-border/35 pt-6'>
        <div className='max-w-sm'>
          <Field label='Project language'>
            <Select
              value={draft.projectLocaleTag}
              onValueChange={(projectLocaleTag) =>
                setDraft((current) => ({ ...current, projectLocaleTag }))
              }
            >
              <SelectTrigger
                aria-label='Project language'
                className={cn('w-full', projectInformationControlClassName)}
              >
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {SUPPORTED_PROJECT_LOCALES.map((language) => (
                  <SelectItem key={language.localeTag} value={language.localeTag}>
                    {formatLanguageOptionLabel(language)}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </Field>
        </div>
      </section>
    </div>
  );
}

function ProjectMetadata({
  label,
  value,
}: {
  label: string;
  value: string;
}) {
  return (
    <div className='grid gap-1.5'>
      <span className={projectInformationSectionHeadingClassName}>{label}</span>
      <p className='text-sm font-medium text-foreground'>{value}</p>
    </div>
  );
}

function Field({
  label,
  children,
}: {
  label: string;
  children: ReactNode;
}) {
  return (
    <label className='grid gap-1.5'>
      <span className={projectInformationSectionHeadingClassName}>{label}</span>
      {children}
    </label>
  );
}

function formatLanguageOptionLabel(language: {
  displayName: string;
  localeTag: string;
}): string {
  return `${language.displayName} (${language.localeTag})`;
}
