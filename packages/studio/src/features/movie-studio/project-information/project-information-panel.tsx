import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { Plus, Trash2 } from 'lucide-react';
import type { ProjectLanguage } from '@gorenku/studio-core/client';
import type {
  ProjectInformationResourceResponse,
  ProjectInformationUpdateRequest,
  ProjectShellWithHttp,
} from '@/services/studio-project-contracts';
import {
  readProject,
  readProjectInformationResource,
  updateProjectInformation,
} from '@/services/studio-projects-api';
import {
  useDebouncedAutosave,
  type DebouncedSaveStatus,
} from '@/hooks/use-debounced-autosave';
import {
  matchesProjectInformationResource,
  useStudioResourceRefresh,
} from '@/hooks/use-studio-resource-refresh';
import { Button } from '@/ui/button';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from '@/ui/dropdown-menu';
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

const ASPECT_RATIOS = ['1:1', '3:4', '4:3', '16:9', '9:16', '21:9'] as const;

const projectInformationControlClassName =
  'border-border/55 bg-background/45 shadow-none transition-colors hover:border-primary/45 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/20';

const projectInformationSectionHeadingClassName =
  'text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground';

const LANGUAGE_CATALOG = [
  { localeTag: 'en-US', displayName: 'English' },
  { localeTag: 'es-ES', displayName: 'Spanish' },
  { localeTag: 'de-DE', displayName: 'German' },
  { localeTag: 'fr-FR', displayName: 'French' },
  { localeTag: 'zh-CN', displayName: 'Chinese' },
  { localeTag: 'ja-JP', displayName: 'Japanese' },
  { localeTag: 'tr-TR', displayName: 'Turkish' },
] as const;

interface ProjectInformationPanelProps {
  project: ProjectShellWithHttp;
  onProjectChange: (project: ProjectShellWithHttp) => void;
  onSaveStatusChange: (status: DebouncedSaveStatus) => void;
}

interface ProjectInformationForm {
  title: string;
  aspectRatio: string;
  logline: string;
  synopsis: string;
  premise: string;
  languages: ProjectLanguage[];
}

export function ProjectInformationPanel({
  project,
  onProjectChange,
  onSaveStatusChange,
}: ProjectInformationPanelProps) {
  const projectForm = useMemo(
    () => toProjectInformationForm(project),
    [project]
  );
  const [form, setForm] = useState<ProjectInformationForm>(() =>
    projectForm
  );
  const [resourceRevision, setResourceRevision] = useState(0);
  const formRef = useRef(form);
  const lastProjectFormRef = useRef(projectForm);
  const lastProjectFormSignatureRef = useRef(
    projectInformationFormSignature(projectForm)
  );

  useEffect(() => {
    formRef.current = form;
  }, [form]);

  const availableLanguages = useMemo(() => {
    const selected = new Set(
      form.languages.map((language) => language.localeTag)
    );
    return LANGUAGE_CATALOG.filter(
      (language) => !selected.has(language.localeTag)
    );
  }, [form.languages]);

  const save = useCallback(
    async (nextForm: ProjectInformationForm) => {
      return await updateProjectInformation(
        project.project.projectName,
        toProjectInformationUpdate(nextForm)
      );
    },
    [project.project.projectName]
  );
  const isAutosaveReady = useCallback(
    (nextForm: ProjectInformationForm) =>
      projectInformationFormSignature(nextForm) !==
      lastProjectFormSignatureRef.current,
    []
  );

  const autosave = useDebouncedAutosave({
    value: form,
    save,
    failureMessage: 'Project information could not be saved.',
    onSaved: () => {
      void readProject(project.project.projectName).then(onProjectChange);
    },
    isReady: isAutosaveReady,
  });

  useEffect(() => {
    let cancelled = false;
    const requestedProjectFormSignature =
      projectInformationFormSignature(projectForm);
    const requestedProjectIdentitySignature =
      projectInformationIdentitySignature(projectForm);
    void readProjectInformationResource(project.project.projectName)
      .then((nextResource) => {
        const nextResourceForm = toProjectInformationResourceForm(nextResource);
        if (
          cancelled ||
          lastProjectFormSignatureRef.current !== requestedProjectFormSignature ||
          projectInformationIdentitySignature(nextResourceForm) !==
            requestedProjectIdentitySignature
        ) {
          return;
        }
        setForm((current) =>
          projectInformationFormSignature(current) ===
          projectInformationFormSignature(lastProjectFormRef.current)
            ? nextResourceForm
            : current
        );
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [project.project.projectName, projectForm, resourceRevision]);

  useStudioResourceRefresh({
    projectName: project.project.projectName,
    matches: matchesProjectInformationResource,
    onRefresh: () => setResourceRevision((current) => current + 1),
  });

  useEffect(() => {
    onSaveStatusChange(autosave);
  }, [autosave, onSaveStatusChange]);

  useEffect(() => {
    const previousProjectForm = lastProjectFormRef.current;
    const currentDraft = formRef.current;
    const nextProjectFormSignature = projectInformationFormSignature(projectForm);

    lastProjectFormRef.current = projectForm;
    lastProjectFormSignatureRef.current = nextProjectFormSignature;

    if (
      projectInformationFormSignature(currentDraft) ===
      projectInformationFormSignature(previousProjectForm)
    ) {
      setForm(projectForm);
    }
  }, [projectForm]);

  const addLanguage = (localeTag: string) => {
    const language = LANGUAGE_CATALOG.find((entry) => entry.localeTag === localeTag);
    if (!language) {
      return;
    }
    setForm((current) => ({
      ...current,
      languages: [
        ...current.languages,
        {
          id: `new_${language.localeTag}`,
          localeTag: language.localeTag,
          displayName: language.displayName,
          isBase: current.languages.length === 0,
          supportsAudio: true,
          supportsSubtitles: true,
        },
      ],
    }));
  };

  const updateLanguage = (
    localeTag: string,
    update: (language: ProjectLanguage) => ProjectLanguage
  ) => {
    setForm((current) => ({
      ...current,
      languages: current.languages.map((language) =>
        language.localeTag === localeTag ? update(language) : language
      ),
    }));
  };

  const removeLanguage = (localeTag: string) => {
    setForm((current) => ({
      ...current,
      languages: current.languages.filter(
        (language) => language.localeTag !== localeTag
      ),
    }));
  };

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
                value={form.title}
                onChange={(event) =>
                  setForm((current) => ({
                    ...current,
                    title: event.target.value,
                  }))
                }
                className={projectInformationControlClassName}
              />
            </Field>
            <Field label='Aspect Ratio'>
              <Select
                value={form.aspectRatio}
                onValueChange={(aspectRatio) =>
                  setForm((current) => ({ ...current, aspectRatio }))
                }
              >
                <SelectTrigger
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
              value={form.logline}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  logline: event.target.value,
                }))
              }
              className={cn('min-h-20', projectInformationControlClassName)}
            />
          </Field>

          <Field label='Synopsis'>
            <Textarea
              value={form.synopsis}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  synopsis: event.target.value,
                }))
              }
              className={cn('min-h-32', projectInformationControlClassName)}
            />
          </Field>

          <Field label='Premise'>
            <Textarea
              value={form.premise}
              onChange={(event) =>
                setForm((current) => ({
                  ...current,
                  premise: event.target.value,
                }))
              }
              className={cn('min-h-20', projectInformationControlClassName)}
            />
          </Field>
        </div>
      </section>

      <section className='space-y-4 border-t border-border/35 pt-6'>
        <div className='flex items-center justify-between gap-3'>
          <h3 className={projectInformationSectionHeadingClassName}>Languages</h3>
          {availableLanguages.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button type='button' variant='outline' size='sm'>
                  <Plus className='h-3.5 w-3.5' />
                  Add language
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end' className='w-[190px]'>
                {availableLanguages.map((language) => (
                  <DropdownMenuItem
                    key={language.localeTag}
                    onClick={() => addLanguage(language.localeTag)}
                  >
                    {formatLanguageOptionLabel(language)}
                  </DropdownMenuItem>
                ))}
              </DropdownMenuContent>
            </DropdownMenu>
          ) : null}
        </div>

        {form.languages.length === 0 ? (
          <p className='text-sm text-muted-foreground'>
            No project languages configured.
          </p>
        ) : null}

        <div className='divide-y divide-border/35'>
          {form.languages.map((language) => {
            const canRemove = form.languages.length > 1 && !language.isBase;
            return (
              <div
                key={language.localeTag}
                className='grid gap-2 py-3 first:pt-0 last:pb-0 md:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto]'
              >
                <div className='min-w-0'>
                  <p className='truncate text-sm font-medium'>
                    {language.displayName ?? language.localeTag}
                  </p>
                  <p className='text-xs text-muted-foreground'>
                    {language.localeTag}
                  </p>
                </div>
                <ToggleButton
                  active={language.isBase}
                  label='Base'
                  onClick={() =>
                    updateLanguage(language.localeTag, (currentLanguage) => ({
                      ...currentLanguage,
                      isBase: true,
                    }))
                  }
                  updateAll={() =>
                    setForm((current) => ({
                      ...current,
                      languages: current.languages.map((entry) => ({
                        ...entry,
                        isBase: entry.localeTag === language.localeTag,
                      })),
                    }))
                  }
                />
                <ToggleButton
                  active={language.supportsAudio}
                  label='Audio'
                  onClick={() =>
                    updateLanguage(language.localeTag, (currentLanguage) => ({
                      ...currentLanguage,
                      supportsAudio: !currentLanguage.supportsAudio,
                    }))
                  }
                />
                <ToggleButton
                  active={language.supportsSubtitles}
                  label='Subtitles'
                  onClick={() =>
                    updateLanguage(language.localeTag, (currentLanguage) => ({
                      ...currentLanguage,
                      supportsSubtitles: !currentLanguage.supportsSubtitles,
                    }))
                  }
                />
                <Button
                  type='button'
                  variant='ghost'
                  size='icon'
                  disabled={!canRemove}
                  aria-label={`Remove ${language.displayName ?? language.localeTag}`}
                  onClick={() => removeLanguage(language.localeTag)}
                  className='h-8 w-8 justify-self-start text-muted-foreground hover:text-destructive md:justify-self-end'
                >
                  <Trash2 className='h-4 w-4' />
                </Button>
              </div>
            );
          })}
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

function ToggleButton({
  active,
  label,
  onClick,
  updateAll,
}: {
  active: boolean;
  label: string;
  onClick: () => void;
  updateAll?: () => void;
}) {
  return (
    <Button
      type='button'
      variant='ghost'
      onClick={updateAll ?? onClick}
      className={cn(
        'h-8 justify-self-start rounded-md border px-2 text-xs font-medium md:justify-self-end',
        active
          ? 'border-emerald-500/45 bg-emerald-500/14 text-emerald-700 hover:bg-emerald-500/20 dark:text-emerald-300'
          : 'border-border/40 bg-muted/30 text-muted-foreground hover:bg-item-hover-bg'
      )}
    >
      {label}
    </Button>
  );
}

function formatLanguageOptionLabel(language: {
  displayName: string;
  localeTag: string;
}): string {
  return `${language.displayName} (${language.localeTag})`;
}

function toProjectInformationForm(project: ProjectShellWithHttp): ProjectInformationForm {
  return {
    title: project.project.title,
    aspectRatio: project.project.aspectRatio ?? '16:9',
    logline: project.project.logline ?? '',
    synopsis: project.project.synopsis ?? '',
    premise: project.project.premise ?? '',
    languages: project.languages,
  };
}

function toProjectInformationResourceForm(
  resource: ProjectInformationResourceResponse
): ProjectInformationForm {
  return {
    title: resource.title,
    aspectRatio: resource.aspectRatio ?? '16:9',
    logline: resource.logline ?? '',
    synopsis: resource.synopsis ?? '',
    premise: resource.premise ?? '',
    languages: resource.languages,
  };
}

function toProjectInformationUpdate(
  form: ProjectInformationForm
): ProjectInformationUpdateRequest {
  return {
    title: form.title,
    aspectRatio: form.aspectRatio,
    logline: form.logline,
    synopsis: form.synopsis,
    premise: form.premise,
    languages: form.languages.map((language) => ({
      localeTag: language.localeTag,
      displayName: language.displayName,
      isBase: language.isBase,
      supportsAudio: language.supportsAudio,
      supportsSubtitles: language.supportsSubtitles,
    })),
  };
}

function projectInformationFormSignature(form: ProjectInformationForm): string {
  return JSON.stringify(toProjectInformationUpdate(form));
}

function projectInformationIdentitySignature(
  form: Pick<
    ProjectInformationForm,
    'title' | 'aspectRatio' | 'logline' | 'synopsis' | 'premise'
  >
): string {
  return JSON.stringify({
    title: form.title,
    aspectRatio: form.aspectRatio,
    logline: form.logline,
    synopsis: form.synopsis,
    premise: form.premise,
  });
}
