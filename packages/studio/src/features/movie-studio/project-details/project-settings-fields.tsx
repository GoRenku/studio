import { useRef } from 'react';
import {
  GENERATION_LANES,
  GENERATION_LANE_SLUGS,
  HOST_GENERATION_PROVIDER,
  type DefaultModelListResource,
  type GenerationLane,
  type ProjectGenerationSettings,
  type ProjectSettingsDocument,
  type ProviderCredentialStatus,
} from '@gorenku/studio-core/client';
import { KeyRound } from 'lucide-react';
import { AppSettingsDialog } from '@/features/settings/app-settings-dialog';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/ui/accordion';
import { Button } from '@/ui/button';
import { GenerationLaneSection, type ProviderOption } from './generation-lane-section';
import { SettingsSwitchRow } from './project-settings-rows';

export function ProjectSettingsFields({ settings, onChange, providers, providersLoading, onRefreshProviders, defaultModels }: {
  settings: ProjectSettingsDocument;
  onChange: (settings: ProjectSettingsDocument) => void;
  providers: ProviderCredentialStatus[] | null;
  providersLoading: boolean;
  onRefreshProviders: () => void;
  defaultModels: DefaultModelListResource | null;
}) {
  const imageHeadingRef = useRef<HTMLButtonElement>(null);
  const updateScreenplayImport = (field: keyof ProjectSettingsDocument['screenplayImport'], value: boolean) => {
    onChange({ ...settings, screenplayImport: { ...settings.screenplayImport, [field]: value } });
  };
  const updateGeneration = (generation: ProjectGenerationSettings) => onChange({ ...settings, generation });
  const mediaProviders = providers?.filter((provider) => provider.configured && provider.provider !== 'world-labs') ?? [];
  const generalProviders = mediaProviders.filter((provider) => provider.provider !== 'elevenlabs').map((provider) => ({ value: provider.provider, label: provider.label }));
  const audioProviders = mediaProviders.map((provider) => ({ value: provider.provider, label: provider.label }));
  const hostProvider = { value: HOST_GENERATION_PROVIDER.provider, label: HOST_GENERATION_PROVIDER.label };
  const laneProviderOptions: Record<GenerationLane, ProviderOption[]> = {
    image: [hostProvider, ...generalProviders],
    imageEdit: [hostProvider, ...generalProviders],
    video: generalProviders,
    audio: audioProviders,
  };
  const noApiKeys = providers !== null && !providersLoading && !providers.some((provider) => provider.configured);
  const providerStatus = { providers, providersLoading, onRefreshProviders };
  return (
    <Accordion type='multiple' defaultValue={['screenplay-import', 'generation', ...GENERATION_LANES.map((lane) => `lane-${GENERATION_LANE_SLUGS[lane]}`)]}>
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
      {GENERATION_LANES.map((lane, index) => (
        <GenerationLaneSection key={lane} lane={lane} settings={settings.generation[lane]} providerOptions={laneProviderOptions[lane]} providerStatus={providerStatus} defaultModels={defaultModels} headingRef={index === 0 ? imageHeadingRef : undefined} onChange={(laneSettings) => updateGeneration({ ...settings.generation, [lane]: laneSettings })} />
      ))}
    </Accordion>
  );
}
