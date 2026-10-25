import { useRef, type RefObject } from 'react';
import {
  GENERATION_LANE_LABELS,
  HOST_GENERATION_PROVIDER,
  GENERATION_LANE_SLUGS,
  type DefaultModelListResource,
  type GenerationLane,
  type GenerationLaneModel,
  type GenerationLaneSettings,
  type ProviderCredentialStatus,
} from '@gorenku/studio-core/client';
import { AppSettingsDialog } from '@/features/settings/app-settings-dialog';
import { AccordionContent, AccordionItem, AccordionTrigger } from '@/ui/accordion';
import { Button } from '@/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { SettingsSelectRow, SettingsSwitchRow } from './project-settings-rows';

export interface ProviderOption {
  value: string;
  label: string;
}

export interface ProviderStatus {
  providers: ProviderCredentialStatus[] | null;
  providersLoading: boolean;
  onRefreshProviders: () => void;
}

const HOST_PROVIDER = HOST_GENERATION_PROVIDER.provider;

export function GenerationLaneSection({ lane, settings, providerOptions, providerStatus, defaultModels, headingRef, onChange }: {
  lane: GenerationLane;
  settings: GenerationLaneSettings;
  providerOptions: ProviderOption[];
  providerStatus: ProviderStatus;
  defaultModels: DefaultModelListResource | null;
  headingRef?: RefObject<HTMLButtonElement | null>;
  onChange: (settings: GenerationLaneSettings) => void;
}) {
  const id = GENERATION_LANE_SLUGS[lane];
  const title = GENERATION_LANE_LABELS[lane];
  return (
    <AccordionItem value={`lane-${id}`}>
      <AccordionTrigger ref={headingRef} className='py-3'>{title}</AccordionTrigger>
      <AccordionContent className='pb-3'>
        <ProviderSelectRow id={id} title={title} value={settings.provider} options={providerOptions} status={providerStatus} onValueChange={(provider) => onChange({ ...settings, provider, model: null })} />
        <ModelSelectRow id={id} lane={lane} provider={settings.provider} value={settings.model} defaultModels={defaultModels} onValueChange={(model) => onChange({ ...settings, model })} />
        <SettingsSwitchRow id={`${id}-choose-route`} label='Choose Provider and Model Each Time' description='Ask which provider and model to use before each generation.' checked={settings.chooseRouteBeforeGenerating} onCheckedChange={(chooseRouteBeforeGenerating) => onChange({ ...settings, chooseRouteBeforeGenerating })} />
        <SettingsSwitchRow id={`${id}-confirmation`} label='Ask Before Generating' description='Review the prompt, references, settings and estimated cost before execution.' checked={settings.askBeforeGenerating} onCheckedChange={(askBeforeGenerating) => onChange({ ...settings, askBeforeGenerating })} />
        <SettingsSwitchRow id={`${id}-concurrency`} label='Run Generations Concurrently' description={`Allow independent ${title.toLowerCase()} requests to run concurrently.`} checked={settings.runGenerationsConcurrently} onCheckedChange={(runGenerationsConcurrently) => onChange({ ...settings, runGenerationsConcurrently })} />
        <SettingsSelectRow id={`${id}-maximum`} label='Max Concurrent Generations' description='Maximum independent requests scheduled together.' value={String(settings.maxConcurrentGenerations)} options={[1, 2, 3, 4, 5].map((maximum) => ({ value: String(maximum), label: String(maximum) }))} disabled={!settings.runGenerationsConcurrently} onValueChange={(maximum) => onChange({ ...settings, maxConcurrentGenerations: Number(maximum) })} />
      </AccordionContent>
    </AccordionItem>
  );
}

function ModelSelectRow({ id, lane, provider, value, defaultModels, onValueChange }: {
  id: string;
  lane: GenerationLane;
  provider: string;
  value: GenerationLaneModel | null;
  defaultModels: DefaultModelListResource | null;
  onValueChange: (model: GenerationLaneModel | null) => void;
}) {
  const entries = defaultModels?.state === 'synced'
    ? defaultModels.lanes[lane].filter((entry) => entry.providers.some((offered) => offered.provider === provider))
    : [];
  // An unset lane model shows the Skill's recommendation for the provider as the selected family.
  const recommended = entries.find((entry) => entry.recommendedFor.includes(provider));
  const selectedKey = value?.key ?? recommended?.model;
  const savedListed = value !== null && entries.some((entry) => entry.model === value.key);
  const options = [
    ...entries.map((entry) => ({ value: entry.model, label: entry.name })),
    ...(value !== null && !savedListed ? [{ value: value.key, label: `${value.name} (not in current Renku skills)` }] : []),
  ];
  const select = (key: string) => {
    if (key === selectedKey) return;
    const entry = entries.find((candidate) => candidate.model === key);
    if (entry) onValueChange({ key: entry.model, name: entry.name });
  };
  return (
    <div className='flex items-center justify-between gap-6 border-b border-border/35 py-3'>
      <div className='min-w-0'>
        <p id={`${id}-model-label`} className='text-sm font-medium text-foreground'>Model</p>
        <p id={`${id}-model-description`} className='mt-1 text-xs leading-4 text-muted-foreground'>Default model for the selected provider.</p>
      </div>
      <Select value={selectedKey ?? ''} onValueChange={select} disabled={options.length === 0}>
        <SelectTrigger size='sm' className='w-64 shrink-0 disabled:opacity-100 disabled:text-muted-foreground' aria-labelledby={`${id}-model-label`} aria-describedby={`${id}-model-description`}><SelectValue placeholder='No models available' /></SelectTrigger>
        <SelectContent position='popper'>
          {options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}

function ProviderSelectRow({ id, title, value, options, status, onValueChange }: {
  id: string;
  title: string;
  value: string;
  options: ProviderOption[];
  status: ProviderStatus;
  onValueChange: (provider: string) => void;
}) {
  const providerTriggerRef = useRef<HTMLButtonElement>(null);
  const offersHostProvider = options.some((option) => option.value === HOST_PROVIDER);
  const savedProvider = status.providers?.find((provider) => provider.provider === value);
  const noApiKeys = status.providers !== null && !status.providersLoading && !status.providers.some((provider) => provider.configured);
  const empty = status.providers !== null && !status.providersLoading && options.length === 0;
  const unavailable = status.providers !== null && !status.providersLoading && !options.some((option) => option.value === value);
  const missingKey = unavailable && !savedProvider?.configured;
  const selectedLabel = empty ? noApiKeys ? 'No API keys added' : 'No providers available' : unavailable
    ? `${savedProvider?.label ?? 'Saved provider'} (${missingKey ? 'API key missing' : 'unavailable here'})`
    : status.providersLoading && value !== HOST_PROVIDER ? savedProvider?.label ?? 'Saved provider'
    : status.providers === null && value !== HOST_PROVIDER ? 'Saved provider (key status unavailable)' : undefined;
  const visibleOptions = status.providersLoading ? options.filter((option) => option.value === HOST_PROVIDER) : options;
  return (
    <div className='flex items-center justify-between gap-6 border-b border-border/35 py-3'>
      <div className='min-w-0'>
        <p id={`${id}-provider-label`} className='text-sm font-medium text-foreground'>Provider</p>
        <p id={`${id}-provider-description`} className='mt-1 text-xs leading-4 text-muted-foreground'>{empty ? 'Add a provider API key to choose a default.' : value === HOST_PROVIDER ? 'No provider API key required.' : `Default provider for ${title.toLowerCase()}.`}</p>
        {status.providersLoading ? (
          <p className='mt-2 text-xs text-muted-foreground'>Checking saved API keys...</p>
        ) : unavailable && !noApiKeys ? (
          <div className='mt-2 flex items-center gap-2 text-xs text-muted-foreground'>
            <span>{missingKey ? 'This provider has no saved API key.' : 'This provider is not available for this setting.'}</span>
            {missingKey ? <AppSettingsDialog trigger={<Button type='button' variant='link' size='sm' className='h-auto p-0'>Add API keys</Button>} onClose={status.onRefreshProviders} returnFocusRef={providerTriggerRef} /> : null}
          </div>
        ) : null}
      </div>
      <Select value={value} onValueChange={onValueChange} onOpenChange={(open) => { if (open) status.onRefreshProviders(); }} disabled={empty || (status.providers === null && !offersHostProvider)}>
        <SelectTrigger ref={providerTriggerRef} size='sm' className='w-64 shrink-0 disabled:opacity-100 disabled:text-muted-foreground' aria-labelledby={`${id}-provider-label`} aria-describedby={`${id}-provider-description`}><SelectValue>{selectedLabel}</SelectValue></SelectTrigger>
        <SelectContent position='popper'>
          {status.providersLoading ? <p className='px-2 py-1.5 text-sm text-muted-foreground'>Checking saved API keys...</p> : visibleOptions.length === 0 ? <p className='px-2 py-1.5 text-sm text-muted-foreground'>No providers available for this setting</p> : null}
          {visibleOptions.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}
        </SelectContent>
      </Select>
    </div>
  );
}
