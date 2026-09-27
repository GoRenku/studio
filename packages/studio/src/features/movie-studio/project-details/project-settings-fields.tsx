import { useRef, type RefObject } from 'react';
import type {
  GenerationMediaSettings,
  ProjectGenerationSettings,
  ProjectSettingsDocument,
  ProviderCredentialStatus,
} from '@gorenku/studio-core/client';
import { KeyRound } from 'lucide-react';
import { AppSettingsDialog } from '@/features/settings/app-settings-dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/ui/accordion';
import { Button } from '@/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Switch } from '@/ui/switch';

export function ProjectSettingsFields({ settings, onChange, providers, providersLoading, onRefreshProviders }: {
  settings: ProjectSettingsDocument;
  onChange: (settings: ProjectSettingsDocument) => void;
  providers: ProviderCredentialStatus[] | null;
  providersLoading: boolean;
  onRefreshProviders: () => void;
}) {
  const imageHeadingRef = useRef<HTMLButtonElement>(null);
  const updateScreenplayImport = (field: keyof ProjectSettingsDocument['screenplayImport'], value: boolean) => {
    onChange({ ...settings, screenplayImport: { ...settings.screenplayImport, [field]: value } });
  };
  const updateGeneration = (generation: ProjectGenerationSettings) => onChange({ ...settings, generation });
  const mediaProviders = providers?.filter((provider) => provider.configured && provider.provider !== 'world-labs') ?? [];
  const generalProviders = mediaProviders.filter((provider) => provider.provider !== 'elevenlabs').map((provider) => ({ value: provider.provider, label: provider.label }));
  const audioProviders = mediaProviders.map((provider) => ({ value: provider.provider, label: provider.label }));
  const noApiKeys = providers !== null && !providersLoading && !providers.some((provider) => provider.configured);
  const providerStatus = { providers, providersLoading, onRefreshProviders };
  return (
    <Accordion type='multiple' defaultValue={['screenplay-import', 'generation', 'image-generation', 'video-generation', 'audio-generation']}>
      <AccordionItem value='screenplay-import'>
        <AccordionTrigger className='py-3'>Screenplay Import</AccordionTrigger>
        <AccordionContent>
          <SettingsSwitchRow id='create-continuity-subjects' label='Create cast, locations, and props' description='After importing Final Draft, continue with unambiguous continuity facts and screenplay reference bindings.' checked={settings.screenplayImport.createContinuitySubjects} onCheckedChange={(checked) => updateScreenplayImport('createContinuitySubjects', checked)} />
          <SettingsSwitchRow id='generate-continuity-images' label='Generate profile and hero images' description='Generate a Cast Profile, Location Hero, or Prop Hero after the corresponding continuity subject is ready.' checked={settings.screenplayImport.generateContinuityImages} onCheckedChange={(checked) => updateScreenplayImport('generateContinuityImages', checked)} />
          <SettingsSwitchRow id='run-screenplay-analysis' label='Analyze the screenplay' description='Run screenplay analysis after the imported screenplay and accepted reference bindings are ready.' checked={settings.screenplayImport.runScreenplayAnalysis} onCheckedChange={(checked) => updateScreenplayImport('runScreenplayAnalysis', checked)} />
          <SettingsSwitchRow id='generate-scene-beats' label='Generate Scene Beats' description='Create an active Scene Beats revision for each imported Scene after its required project context is ready.' checked={settings.screenplayImport.generateSceneBeats} onCheckedChange={(checked) => updateScreenplayImport('generateSceneBeats', checked)} />
          <SettingsSwitchRow id='generate-beat-storyboard-images' label='Generate storyboard images' description='Generate and import storyboard images for the current Beats after each Scene has an active Scene Beats revision.' checked={settings.screenplayImport.generateBeatStoryboardImages} onCheckedChange={(checked) => updateScreenplayImport('generateBeatStoryboardImages', checked)} last />
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value='generation'>
        <AccordionTrigger className='py-3'>Generation</AccordionTrigger>
        <AccordionContent>
          <SettingsSwitchRow id='display-generation-previews' label='Show Generation Previews' description='Open Generation Preview automatically before execution. Explicit Preview requests still work when this is off.' checked={settings.generation.displayPreview} onCheckedChange={(displayPreview) => updateGeneration({ ...settings.generation, displayPreview })} />
          <SettingsSwitchRow id='enable-provider-prompt-expansion' label='Enable prompt expansion at the provider level when available for a model' description='Apply this preference only when the selected provider route exposes an unambiguous prompt-expansion control in its live schema.' checked={settings.generation.enableProviderPromptExpansion} onCheckedChange={(enableProviderPromptExpansion) => updateGeneration({ ...settings.generation, enableProviderPromptExpansion })} last />
        </AccordionContent>
      </AccordionItem>
      {noApiKeys ? (
        <section aria-label='Provider API key setup' className='-mx-3 mb-3 mt-2 flex items-center gap-4 rounded-lg border border-primary/80 bg-primary/5 px-5 py-3'>
          <KeyRound className='h-5 w-5 shrink-0 text-primary' aria-hidden='true' />
          <div className='min-w-0 flex-1'>
            <p className='text-sm font-semibold text-foreground'>Add API keys to enable more providers</p>
            <p className='mt-1 text-xs leading-4 text-muted-foreground'>Video and audio generation need a provider API key. Images can use Codex without one.</p>
          </div>
          <AppSettingsDialog trigger={<Button type='button' size='sm' className='shrink-0 px-4 font-semibold'>Add API keys</Button>} onClose={onRefreshProviders} returnFocusRef={imageHeadingRef} />
        </section>
      ) : null}
      <MediaGenerationSection title='Image Generation' value='image-generation' id='image' settings={settings.generation.image} providerOptions={[{ value: 'codex', label: 'ChatGPT Images 2.5 (Codex)' }, ...generalProviders]} providerStatus={providerStatus} headingRef={imageHeadingRef} onChange={(image) => updateGeneration({ ...settings.generation, image })} />
      <MediaGenerationSection title='Video Generation' value='video-generation' id='video' settings={settings.generation.video} providerOptions={generalProviders} providerStatus={providerStatus} onChange={(video) => updateGeneration({ ...settings.generation, video })} />
      <MediaGenerationSection title='Audio Generation' value='audio-generation' id='audio' settings={settings.generation.audio} providerOptions={audioProviders} providerStatus={providerStatus} onChange={(audio) => updateGeneration({ ...settings.generation, audio })} />
    </Accordion>
  );
}

function MediaGenerationSection({ title, value, id, settings, providerOptions, providerStatus, headingRef, onChange }: {
  title: string;
  value: string;
  id: string;
  settings: GenerationMediaSettings<string>;
  providerOptions: Array<{ value: string; label: string }>;
  headingRef?: RefObject<HTMLButtonElement | null>;
  providerStatus: {
    providers: ProviderCredentialStatus[] | null;
    providersLoading: boolean;
    onRefreshProviders: () => void;
  };
  onChange: (settings: GenerationMediaSettings<string>) => void;
}) {
  return (
    <AccordionItem value={value}>
      <AccordionTrigger ref={headingRef} className='py-3'>{title}</AccordionTrigger>
      <AccordionContent className='pb-3'>
        <ProviderSelectRow id={id} value={settings.provider} options={providerOptions} status={providerStatus} onValueChange={(provider) => onChange({ ...settings, provider })} />
        <SettingsSwitchRow id={`${id}-confirmation`} label='Ask Before Generating' description='Pause for confirmation immediately before execution.' checked={settings.askBeforeGenerating} onCheckedChange={(askBeforeGenerating) => onChange({ ...settings, askBeforeGenerating })} />
        <SettingsSwitchRow id={`${id}-concurrency`} label='Run Generations Concurrently' description={`Allow independent ${id} requests to run concurrently.`} checked={settings.runGenerationsConcurrently} onCheckedChange={(runGenerationsConcurrently) => onChange({ ...settings, runGenerationsConcurrently })} />
        <SettingsSelectRow id={`${id}-maximum`} label='Max Concurrent Generations' description='Maximum independent requests scheduled together.' value={String(settings.maxConcurrentGenerations)} options={[1, 2, 3, 4, 5].map((maximum) => ({ value: String(maximum), label: String(maximum) }))} disabled={!settings.runGenerationsConcurrently} onValueChange={(maximum) => onChange({ ...settings, maxConcurrentGenerations: Number(maximum) })} />
      </AccordionContent>
    </AccordionItem>
  );
}

function ProviderSelectRow({ id, value, options, status, onValueChange }: {
  id: string;
  value: string;
  options: Array<{ value: string; label: string }>;
  status: {
    providers: ProviderCredentialStatus[] | null;
    providersLoading: boolean;
    onRefreshProviders: () => void;
  };
  onValueChange: (provider: string) => void;
}) {
  const providerTriggerRef = useRef<HTMLButtonElement>(null);
  const savedProvider = status.providers?.find((provider) => provider.provider === value);
  const noApiKeys = status.providers !== null && !status.providersLoading && !status.providers.some((provider) => provider.configured);
  const empty = status.providers !== null && !status.providersLoading && options.length === 0;
  const unavailable = status.providers !== null && !status.providersLoading && !options.some((option) => option.value === value);
  const missingKey = unavailable && !savedProvider?.configured;
  const selectedLabel = empty ? noApiKeys ? 'No API keys added' : 'No providers available' : unavailable
    ? `${savedProvider?.label ?? 'Saved provider'} (${missingKey ? 'API key missing' : 'unavailable here'})`
    : status.providersLoading && value !== 'codex' ? savedProvider?.label ?? 'Saved provider'
    : status.providers === null && value !== 'codex' ? 'Saved provider (key status unavailable)' : undefined;
  const visibleOptions = status.providersLoading ? options.filter((option) => option.value === 'codex') : options;
  return (
    <div className='flex items-center justify-between gap-6 border-b border-border/35 py-3'>
      <div className='min-w-0'>
        <p id={`${id}-provider-label`} className='text-sm font-medium text-foreground'>Provider</p>
        <p id={`${id}-provider-description`} className='mt-1 text-xs leading-4 text-muted-foreground'>{empty ? 'Add a provider API key to choose a default.' : value === 'codex' ? 'No provider API key required.' : `Default provider for ${id} generation.`}</p>
        {status.providersLoading ? (
          <p className='mt-2 text-xs text-muted-foreground'>Checking saved API keys...</p>
        ) : unavailable && !noApiKeys ? (
          <div className='mt-2 flex items-center gap-2 text-xs text-muted-foreground'>
            <span>{missingKey ? 'This provider has no saved API key.' : 'This provider is not available for this setting.'}</span>
            {missingKey ? <AppSettingsDialog trigger={<Button type='button' variant='link' size='sm' className='h-auto p-0'>Add API keys</Button>} onClose={status.onRefreshProviders} returnFocusRef={providerTriggerRef} /> : null}
          </div>
        ) : null}
      </div>
      <Select value={value} onValueChange={onValueChange} onOpenChange={(open) => { if (open) status.onRefreshProviders(); }} disabled={empty || (status.providers === null && id !== 'image')}>
        <SelectTrigger ref={providerTriggerRef} size='sm' className='w-64 shrink-0 disabled:opacity-100 disabled:text-muted-foreground' aria-labelledby={`${id}-provider-label`} aria-describedby={`${id}-provider-description`}><SelectValue>{selectedLabel}</SelectValue></SelectTrigger>
        <SelectContent position='popper'>
          {status.providersLoading ? <p className='px-2 py-1.5 text-sm text-muted-foreground'>Checking saved API keys...</p> : visibleOptions.length === 0 ? <p className='px-2 py-1.5 text-sm text-muted-foreground'>No providers available for this setting</p> : null}
          {visibleOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function SettingsSwitchRow({ id, label, description, checked, onCheckedChange, last = false }: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  last?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-6 py-3 ${last ? '' : 'border-b border-border/35'}`}>
      <div className='min-w-0'><p id={`${id}-label`} className='text-sm font-medium text-foreground'>{label}</p><p id={`${id}-description`} className='mt-1 text-xs leading-4 text-muted-foreground'>{description}</p></div>
      <Switch aria-labelledby={`${id}-label`} aria-describedby={`${id}-description`} checked={checked} onCheckedChange={onCheckedChange} />
    </div>
  );
}

function SettingsSelectRow<Value extends string>({ id, label, description, value, options, disabled = false, onValueChange }: {
  id: string;
  label: string;
  description: string;
  value: Value;
  options: Array<{ value: Value; label: string }>;
  disabled?: boolean;
  onValueChange: (value: Value) => void;
}) {
  return (
    <div className='flex items-center justify-between gap-6 border-b border-border/35 py-3'>
      <div className='min-w-0'><p id={`${id}-label`} className='text-sm font-medium text-foreground'>{label}</p><p id={`${id}-description`} className='mt-1 text-xs leading-4 text-muted-foreground'>{description}</p></div>
      <Select value={value} onValueChange={(next) => onValueChange(next as Value)} disabled={disabled}>
        <SelectTrigger size='sm' className='w-44' aria-labelledby={`${id}-label`} aria-describedby={`${id}-description`}><SelectValue /></SelectTrigger>
        <SelectContent>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}
