import {
  useCallback,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from 'react';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import type { ProjectLanguage } from '@gorenku/studio-core';
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
  type DebouncedAutosaveStatus,
} from '@/hooks/use-debounced-autosave';
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
import { MarkdownAssetEditor } from '../markdown-asset-editor';

const ASPECT_RATIOS = ['1:1', '3:4', '4:3', '16:9', '9:16', '21:9'] as const;

const projectInformationControlClassName =
  'border-border/60 bg-background/35 transition-colors hover:border-primary/50 focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/25';

const projectInformationLanguageTriggerClassName =
  "border-border/60 bg-background/35 [&_svg:not([class*='text-'])]:text-muted-foreground focus-visible:border-primary focus-visible:ring-[3px] focus-visible:ring-primary/25 data-[state=open]:border-primary data-[state=open]:ring-[3px] data-[state=open]:ring-primary/25 dark:bg-input/30 dark:hover:bg-input/50 flex h-8 w-[190px] items-center justify-between gap-2 rounded-md border px-3 py-2 text-sm whitespace-nowrap shadow-xs transition-[color,box-shadow] outline-none hover:border-primary/50 disabled:cursor-not-allowed disabled:opacity-50 [&_svg]:pointer-events-none [&_svg]:shrink-0 [&_svg:not([class*='size-'])]:size-4";

const projectInformationReadOnlyControlClassName =
  'border-border/45 bg-muted/25 text-muted-foreground';

const projectInformationSectionClassName =
  'rounded-lg border border-border/45 bg-background/35 p-4 shadow-sm';

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
  onAutosaveStatusChange: (status: DebouncedAutosaveStatus) => void;
}

interface ProjectInformationForm {
  title: string;
  aspectRatio: string;
  logline: string;
  languages: ProjectLanguage[];
}

export function ProjectInformationPanel({
  project,
  onProjectChange,
  onAutosaveStatusChange,
}: ProjectInformationPanelProps) {
  const projectForm = useMemo(
    () => toProjectInformationForm(project),
    [project]
  );
  const [form, setForm] = useState<ProjectInformationForm>(() =>
    projectForm
  );
  const [resource, setResource] =
    useState<ProjectInformationResourceResponse | null>(null);
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
        project.identity.name,
        toProjectInformationUpdate(nextForm)
      );
    },
    [project.identity.name]
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
    onSaved: () => {
      void readProject(project.identity.name).then(onProjectChange);
    },
    isReady: isAutosaveReady,
  });

  useEffect(() => {
    let cancelled = false;
    void readProjectInformationResource(project.identity.name)
      .then((nextResource) => {
        if (!cancelled) {
          const nextResourceForm = toProjectInformationResourceForm(nextResource);
          setResource(nextResource);
          setForm((current) =>
            projectInformationFormSignature(current) ===
            projectInformationFormSignature(lastProjectFormRef.current)
              ? nextResourceForm
              : current
          );
        }
      })
      .catch(() => {
        if (!cancelled) {
          setResource(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [project.identity.name]);

  useEffect(() => {
    onAutosaveStatusChange(autosave);
  }, [autosave, onAutosaveStatusChange]);

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

  const projectTypeLabel =
    project.identity.type === 'series' ? 'Series' : 'Movie';

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
    <div className='mx-auto flex w-full max-w-4xl flex-col gap-4'>
      <section className={projectInformationSectionClassName}>
        <div className='grid gap-4 lg:grid-cols-2'>
          <Field label='Project Name'>
            <Input
              value={project.identity.name}
              readOnly
              className={projectInformationReadOnlyControlClassName}
            />
          </Field>
          <Field label='Type'>
            <Input
              value={projectTypeLabel}
              readOnly
              className={projectInformationReadOnlyControlClassName}
            />
          </Field>
        </div>
      </section>

      <section className={projectInformationSectionClassName}>
        <div className='grid gap-4'>
          <div className='grid gap-4 lg:grid-cols-[minmax(0,1fr)_180px]'>
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
              className={cn('min-h-24', projectInformationControlClassName)}
            />
          </Field>

          <MarkdownAssetEditor
            projectName={project.identity.name}
            label='Summary'
            asset={resource?.summaryAsset}
            initialContent=''
            emptyMessage='No editable project summary asset is attached yet.'
            minHeightClassName='min-h-36'
            onProjectChange={onProjectChange}
          />
        </div>
      </section>

      <section className={cn(projectInformationSectionClassName, 'space-y-3')}>
        <div className='flex items-center justify-between gap-3'>
          <h3 className={projectInformationSectionHeadingClassName}>Languages</h3>
          {availableLanguages.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger
                className={projectInformationLanguageTriggerClassName}
              >
                <span className='flex min-w-0 items-center gap-2 line-clamp-1'>
                  <Plus className='h-3.5 w-3.5 shrink-0 text-muted-foreground' />
                  <span className='truncate'>
                    {formatLanguageOptionLabel(availableLanguages[0])}
                  </span>
                </span>
                <ChevronDown className='h-4 w-4 shrink-0 text-muted-foreground opacity-50' />
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

        <div className='space-y-2'>
          {form.languages.map((language) => {
            const canRemove = form.languages.length > 1 && !language.isBase;
            return (
              <div
                key={language.localeTag}
                className='grid gap-2 rounded-md border border-border/45 bg-card/35 p-3 md:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto]'
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
    title: project.identity.title,
    aspectRatio: project.identity.aspectRatio ?? '16:9',
    logline: project.identity.logline ?? '',
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
