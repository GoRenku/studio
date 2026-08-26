import type {
  GenerationMediaSettings,
  ProjectGenerationSettings,
  ProjectSettingsDocument,
} from '@gorenku/studio-core/client';
import { Accordion, AccordionContent, AccordionItem, AccordionTrigger } from '@/ui/accordion';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { Switch } from '@/ui/switch';

export function ProjectSettingsFields({ settings, onChange }: {
  settings: ProjectSettingsDocument;
  onChange: (settings: ProjectSettingsDocument) => void;
}) {
  const updateScreenplayImport = (field: keyof ProjectSettingsDocument['screenplayImport'], value: boolean) => {
    onChange({ ...settings, screenplayImport: { ...settings.screenplayImport, [field]: value } });
  };
  const updateGeneration = (generation: ProjectGenerationSettings) => onChange({ ...settings, generation });
  return (
    <Accordion type='multiple' defaultValue={['screenplay-import', 'generation', 'image-generation', 'video-generation', 'audio-generation']}>
      <AccordionItem value='screenplay-import'>
        <AccordionTrigger>Screenplay Import</AccordionTrigger>
        <AccordionContent>
          <SettingsSwitchRow id='create-continuity-subjects' label='Create cast, locations, and props' description='After importing Final Draft, continue with unambiguous continuity facts and screenplay reference bindings.' checked={settings.screenplayImport.createContinuitySubjects} onCheckedChange={(checked) => updateScreenplayImport('createContinuitySubjects', checked)} />
          <SettingsSwitchRow id='generate-continuity-images' label='Generate profile and hero images' description='Generate a Cast Profile, Location Hero, or Prop Hero after the corresponding continuity subject is ready.' checked={settings.screenplayImport.generateContinuityImages} onCheckedChange={(checked) => updateScreenplayImport('generateContinuityImages', checked)} />
          <SettingsSwitchRow id='run-screenplay-analysis' label='Analyze the screenplay' description='Run screenplay analysis after the imported screenplay and accepted reference bindings are ready.' checked={settings.screenplayImport.runScreenplayAnalysis} onCheckedChange={(checked) => updateScreenplayImport('runScreenplayAnalysis', checked)} />
          <SettingsSwitchRow id='generate-scene-beats' label='Generate Scene Beats' description='Create an active Scene Beats revision for each imported Scene after its required project context is ready.' checked={settings.screenplayImport.generateSceneBeats} onCheckedChange={(checked) => updateScreenplayImport('generateSceneBeats', checked)} />
          <SettingsSwitchRow id='generate-beat-storyboard-images' label='Generate storyboard images' description='Generate and import storyboard images for the current Beats after each Scene has an active Scene Beats revision.' checked={settings.screenplayImport.generateBeatStoryboardImages} onCheckedChange={(checked) => updateScreenplayImport('generateBeatStoryboardImages', checked)} last />
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value='generation'>
        <AccordionTrigger>Generation</AccordionTrigger>
        <AccordionContent>
          <SettingsSwitchRow id='display-generation-previews' label='Show Generation Previews' description='Open Generation Preview automatically before execution. Explicit Preview requests still work when this is off.' checked={settings.generation.displayPreview} onCheckedChange={(displayPreview) => updateGeneration({ ...settings.generation, displayPreview })} last />
        </AccordionContent>
      </AccordionItem>
      <MediaGenerationSection title='Image Generation' value='image-generation' id='image' settings={settings.generation.image} providers={[{ value: 'codex', label: 'GPT Image 2 (Codex)' }, { value: 'fal-ai', label: 'Fal.ai' }, { value: 'pika', label: 'Pika' }]} onChange={(image) => updateGeneration({ ...settings.generation, image })} />
      <MediaGenerationSection title='Video Generation' value='video-generation' id='video' settings={settings.generation.video} providers={[{ value: 'fal-ai', label: 'Fal.ai' }, { value: 'pika', label: 'Pika' }]} onChange={(video) => updateGeneration({ ...settings.generation, video })} />
      <MediaGenerationSection title='Audio Generation' value='audio-generation' id='audio' settings={settings.generation.audio} providers={[{ value: 'elevenlabs', label: 'ElevenLabs' }]} onChange={(audio) => updateGeneration({ ...settings.generation, audio })} />
    </Accordion>
  );
}

function MediaGenerationSection<Provider extends string>({ title, value, id, settings, providers, onChange }: {
  title: string;
  value: string;
  id: string;
  settings: GenerationMediaSettings<Provider>;
  providers: Array<{ value: Provider; label: string }>;
  onChange: (settings: GenerationMediaSettings<Provider>) => void;
}) {
  return (
    <AccordionItem value={value}>
      <AccordionTrigger>{title}</AccordionTrigger>
      <AccordionContent>
        <SettingsSelectRow id={`${id}-provider`} label='Provider' description={`Provider used for ${id} generation.`} value={settings.provider} options={providers} onValueChange={(provider) => onChange({ ...settings, provider })} />
        <SettingsSwitchRow id={`${id}-confirmation`} label='Ask Before Generating' description='Pause for confirmation immediately before execution.' checked={settings.askBeforeGenerating} onCheckedChange={(askBeforeGenerating) => onChange({ ...settings, askBeforeGenerating })} />
        <SettingsSwitchRow id={`${id}-concurrency`} label='Run Generations Concurrently' description={`Allow independent ${id} requests to run concurrently.`} checked={settings.runGenerationsConcurrently} onCheckedChange={(runGenerationsConcurrently) => onChange({ ...settings, runGenerationsConcurrently })} />
        <SettingsSelectRow id={`${id}-maximum`} label='Max Concurrent Generations' description='Maximum independent requests scheduled together.' value={String(settings.maxConcurrentGenerations)} options={[1, 2, 3, 4, 5].map((maximum) => ({ value: String(maximum), label: String(maximum) }))} disabled={!settings.runGenerationsConcurrently} onValueChange={(maximum) => onChange({ ...settings, maxConcurrentGenerations: Number(maximum) })} />
      </AccordionContent>
    </AccordionItem>
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
    <div className={`flex items-center justify-between gap-6 py-4 ${last ? '' : 'border-b border-border/35'}`}>
      <div className='min-w-0'><p id={`${id}-label`} className='text-sm font-medium text-foreground'>{label}</p><p id={`${id}-description`} className='mt-1 text-xs leading-5 text-muted-foreground'>{description}</p></div>
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
    <div className='flex items-center justify-between gap-6 border-b border-border/35 py-4'>
      <div className='min-w-0'><p id={`${id}-label`} className='text-sm font-medium text-foreground'>{label}</p><p id={`${id}-description`} className='mt-1 text-xs leading-5 text-muted-foreground'>{description}</p></div>
      <Select value={value} onValueChange={(next) => onValueChange(next as Value)} disabled={disabled}>
        <SelectTrigger size='sm' className='w-44' aria-labelledby={`${id}-label`} aria-describedby={`${id}-description`}><SelectValue /></SelectTrigger>
        <SelectContent>{options.map((option) => <SelectItem key={option.value} value={option.value}>{option.label}</SelectItem>)}</SelectContent>
      </Select>
    </div>
  );
}
