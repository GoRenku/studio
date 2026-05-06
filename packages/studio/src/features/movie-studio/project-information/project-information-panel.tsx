import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import { ChevronDown, Plus, Trash2 } from 'lucide-react';
import type { ProjectLanguage } from '@gorenku/studio-core';
import type {
  ProjectInformationUpdateRequest,
  ProjectWithHttp,
} from '@/services/studio-project-contracts';
import { updateProjectInformation } from '@/services/studio-projects-api';
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

const ASPECT_RATIOS = ['1:1', '3:4', '4:3', '16:9', '9:16', '21:9'] as const;

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
  project: ProjectWithHttp;
  onProjectChange: (project: ProjectWithHttp) => void;
  onAutosaveStatusChange: (status: DebouncedAutosaveStatus) => void;
}

interface ProjectInformationForm {
  title: string;
  aspectRatio: string;
  logline: string;
  summary: string;
  languages: ProjectLanguage[];
}

export function ProjectInformationPanel({
  project,
  onProjectChange,
  onAutosaveStatusChange,
}: ProjectInformationPanelProps) {
  const [form, setForm] = useState<ProjectInformationForm>(() =>
    toProjectInformationForm(project)
  );

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

  const autosave = useDebouncedAutosave({
    value: form,
    save,
    onSaved: onProjectChange,
  });

  useEffect(() => {
    onAutosaveStatusChange(autosave);
  }, [autosave, onAutosaveStatusChange]);

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
    <div className='mx-auto flex max-w-4xl flex-col gap-5'>
      <div className='grid gap-4 lg:grid-cols-2'>
        <Field label='Project Name'>
          <Input value={project.identity.name} readOnly className='bg-muted/35' />
        </Field>
        <Field label='Type'>
          <Input value={projectTypeLabel} readOnly className='bg-muted/35' />
        </Field>
      </div>

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
          />
        </Field>
        <Field label='Aspect Ratio'>
          <Select
            value={form.aspectRatio}
            onValueChange={(aspectRatio) =>
              setForm((current) => ({ ...current, aspectRatio }))
            }
          >
            <SelectTrigger className='w-full'>
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
          className='min-h-24'
        />
      </Field>

      <Field label='Summary'>
        <Textarea
          value={form.summary}
          onChange={(event) =>
            setForm((current) => ({
              ...current,
              summary: event.target.value,
            }))
          }
          className='min-h-36'
        />
      </Field>

      <section className='space-y-3 border-t border-border/40 pt-4'>
        <div className='flex items-center justify-between gap-3'>
          <h3 className='text-[11px] uppercase tracking-[0.12em] font-semibold text-muted-foreground'>
            Languages
          </h3>
          {availableLanguages.length > 0 ? (
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <Button
                  type='button'
                  variant='ghost'
                  className='h-8 w-[190px] justify-between rounded-md border border-input bg-transparent px-3 py-2 text-sm shadow-xs hover:bg-item-hover-bg'
                >
                  <span className='flex min-w-0 items-center gap-2'>
                    <Plus className='h-3.5 w-3.5 shrink-0 text-muted-foreground' />
                    <span className='truncate'>
                      {availableLanguages[0].displayName}
                    </span>
                  </span>
                  <ChevronDown className='h-4 w-4 shrink-0 text-muted-foreground opacity-50' />
                </Button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align='end' className='w-[190px]'>
                {availableLanguages.map((language) => (
                  <DropdownMenuItem
                    key={language.localeTag}
                    onClick={() => addLanguage(language.localeTag)}
                  >
                    {language.displayName} ({language.localeTag})
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
                className='grid gap-2 rounded-md border border-border/40 bg-background/30 p-3 md:grid-cols-[minmax(0,1fr)_auto_auto_auto_auto]'
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
    <label className='space-y-1.5'>
      <span className='text-[11px] uppercase tracking-[0.12em] font-semibold text-muted-foreground'>
        {label}
      </span>
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

function toProjectInformationForm(project: ProjectWithHttp): ProjectInformationForm {
  return {
    title: project.identity.title,
    aspectRatio: project.identity.aspectRatio ?? '16:9',
    logline: project.identity.logline ?? '',
    summary: project.identity.summary ?? '',
    languages: project.languages,
  };
}

function toProjectInformationUpdate(
  form: ProjectInformationForm
): ProjectInformationUpdateRequest {
  return {
    title: form.title,
    aspectRatio: form.aspectRatio,
    logline: form.logline,
    summary: form.summary,
    languages: form.languages.map((language) => ({
      localeTag: language.localeTag,
      displayName: language.displayName,
      isBase: language.isBase,
      supportsAudio: language.supportsAudio,
      supportsSubtitles: language.supportsSubtitles,
    })),
  };
}
