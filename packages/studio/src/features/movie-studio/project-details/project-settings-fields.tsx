import type { ProjectSettingsDocument } from '@gorenku/studio-core/client';
import {
  Accordion,
  AccordionContent,
  AccordionItem,
  AccordionTrigger,
} from '@/ui/accordion';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/select';
import { Switch } from '@/ui/switch';

interface ProjectSettingsFieldsProps {
  settings: ProjectSettingsDocument;
  onChange: (settings: ProjectSettingsDocument) => void;
}

export function ProjectSettingsFields({
  settings,
  onChange,
}: ProjectSettingsFieldsProps) {
  const updateScreenplayImport = (
    field: keyof ProjectSettingsDocument['screenplayImport'],
    value: boolean
  ) => {
    onChange({
      ...settings,
      screenplayImport: { ...settings.screenplayImport, [field]: value },
    });
  };
  const updateGeneration = (
    field: 'preferCodexImageGeneration' | 'displayPreview',
    value: boolean
  ) => {
    onChange({
      ...settings,
      generation: { ...settings.generation, [field]: value },
    });
  };
  const updateLane = (
    lane: 'renkuManaged' | 'codexBuiltIn',
    field: 'requirePerRunConfirmation' | 'allowConcurrentGenerations',
    value: boolean
  ) => {
    onChange({
      ...settings,
      generation: {
        ...settings.generation,
        [lane]: { ...settings.generation[lane], [field]: value },
      },
    });
  };
  const updateMaximum = (
    lane: 'renkuManaged' | 'codexBuiltIn',
    value: string
  ) => {
    onChange({
      ...settings,
      generation: {
        ...settings.generation,
        [lane]: {
          ...settings.generation[lane],
          maxConcurrentGenerations: Number(value),
        },
      },
    });
  };

  return (
    <Accordion type='multiple' defaultValue={['screenplay-import']}>
      <AccordionItem value='screenplay-import'>
        <AccordionTrigger>Screenplay Import</AccordionTrigger>
        <AccordionContent>
          <SettingsSwitchRow
            id='create-continuity-subjects'
            label='Create cast, locations, and props'
            description='After importing Final Draft, continue with unambiguous continuity facts and screenplay reference bindings.'
            checked={settings.screenplayImport.createContinuitySubjects}
            onCheckedChange={(checked) =>
              updateScreenplayImport('createContinuitySubjects', checked)
            }
          />
          <SettingsSwitchRow
            id='generate-continuity-images'
            label='Generate profile and hero images'
            description='Generate a Cast Profile, Location Hero, or Prop Hero after the corresponding continuity subject is ready.'
            checked={settings.screenplayImport.generateContinuityImages}
            onCheckedChange={(checked) =>
              updateScreenplayImport('generateContinuityImages', checked)
            }
          />
          <SettingsSwitchRow
            id='run-screenplay-analysis'
            label='Analyze the screenplay'
            description='Run screenplay analysis after the imported screenplay and accepted reference bindings are ready.'
            checked={settings.screenplayImport.runScreenplayAnalysis}
            onCheckedChange={(checked) =>
              updateScreenplayImport('runScreenplayAnalysis', checked)
            }
          />
          <SettingsSwitchRow
            id='generate-scene-beats'
            label='Generate Scene Beats'
            description='Create an active Scene Beats revision for each imported Scene after its required project context is ready.'
            checked={settings.screenplayImport.generateSceneBeats}
            onCheckedChange={(checked) =>
              updateScreenplayImport('generateSceneBeats', checked)
            }
          />
          <SettingsSwitchRow
            id='generate-beat-storyboard-images'
            label='Generate storyboard images'
            description='Generate and import storyboard images for the current Beats after each Scene has an active Scene Beats revision.'
            checked={settings.screenplayImport.generateBeatStoryboardImages}
            onCheckedChange={(checked) =>
              updateScreenplayImport('generateBeatStoryboardImages', checked)
            }
            last
          />
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value='generation'>
        <AccordionTrigger>Generation</AccordionTrigger>
        <AccordionContent>
          <SettingsSwitchRow
            id='prefer-codex-image-generation'
            label='Use Codex for image generation'
            description='On by default. Turn this off to use Renku-managed image generation.'
            checked={settings.generation.preferCodexImageGeneration}
            onCheckedChange={(checked) =>
              updateGeneration('preferCodexImageGeneration', checked)
            }
          />
          <SettingsSwitchRow
            id='display-generation-previews'
            label='Show generation previews'
            description='Open the saved Generation Preview automatically before execution. Explicit Preview requests still work when this is off.'
            checked={settings.generation.displayPreview}
            onCheckedChange={(checked) =>
              updateGeneration('displayPreview', checked)
            }
            last
          />
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value='renku-managed-generation'>
        <AccordionTrigger>Renku-managed generation</AccordionTrigger>
        <AccordionContent>
          <GenerationLaneFields
            id='renku-managed'
            description='Runs through configured providers and may incur usage charges.'
            lane={settings.generation.renkuManaged}
            onConfirmationChange={(checked) =>
              updateLane('renkuManaged', 'requirePerRunConfirmation', checked)
            }
            onConcurrencyChange={(checked) =>
              updateLane('renkuManaged', 'allowConcurrentGenerations', checked)
            }
            onMaximumChange={(value) => updateMaximum('renkuManaged', value)}
          />
        </AccordionContent>
      </AccordionItem>
      <AccordionItem value='codex-built-in-image-generation'>
        <AccordionTrigger>Codex built-in image generation</AccordionTrigger>
        <AccordionContent>
          <GenerationLaneFields
            id='codex-built-in'
            description='Runs through the current Codex image capability and is not a Renku provider run.'
            lane={settings.generation.codexBuiltIn}
            onConfirmationChange={(checked) =>
              updateLane('codexBuiltIn', 'requirePerRunConfirmation', checked)
            }
            onConcurrencyChange={(checked) =>
              updateLane('codexBuiltIn', 'allowConcurrentGenerations', checked)
            }
            onMaximumChange={(value) => updateMaximum('codexBuiltIn', value)}
          />
        </AccordionContent>
      </AccordionItem>
    </Accordion>
  );
}

function GenerationLaneFields({
  id,
  description,
  lane,
  onConfirmationChange,
  onConcurrencyChange,
  onMaximumChange,
}: {
  id: string;
  description: string;
  lane: ProjectSettingsDocument['generation']['renkuManaged'];
  onConfirmationChange: (checked: boolean) => void;
  onConcurrencyChange: (checked: boolean) => void;
  onMaximumChange: (value: string) => void;
}) {
  return (
    <section>
      <div className='pb-2'>
        <p className='text-xs leading-5 text-muted-foreground'>{description}</p>
      </div>
      <SettingsSwitchRow
        id={`${id}-confirmation`}
        label='Ask before generating'
        description={
          id === 'renku-managed'
            ? 'Pause for confirmation immediately before a live provider run.'
            : 'Pause for an additional conversational confirmation before invoking the Codex image tool.'
        }
        checked={lane.requirePerRunConfirmation}
        onCheckedChange={onConfirmationChange}
      />
      <SettingsSwitchRow
        id={`${id}-concurrency`}
        label='Run generations concurrently'
        description={`Allow independent ${id === 'renku-managed' ? 'Renku-managed' : 'Codex image'} requests to run concurrently.`}
        checked={lane.allowConcurrentGenerations}
        onCheckedChange={onConcurrencyChange}
      />
      <SettingsSelectRow
        id={`${id}-maximum`}
        description={`Maximum independent ${id === 'renku-managed' ? 'Renku-managed' : 'Codex image'} requests scheduled together.`}
        value={String(lane.maxConcurrentGenerations)}
        disabled={!lane.allowConcurrentGenerations}
        onValueChange={onMaximumChange}
      />
    </section>
  );
}

function SettingsSwitchRow({
  id,
  label,
  description,
  checked,
  onCheckedChange,
  last = false,
}: {
  id: string;
  label: string;
  description: string;
  checked: boolean;
  onCheckedChange: (checked: boolean) => void;
  last?: boolean;
}) {
  return (
    <div className={`flex items-center justify-between gap-6 py-4 ${last ? '' : 'border-b border-border/35'}`}>
      <div className='min-w-0'>
        <p id={`${id}-label`} className='text-sm font-medium text-foreground'>{label}</p>
        <p id={`${id}-description`} className='mt-1 text-xs leading-5 text-muted-foreground'>{description}</p>
      </div>
      <Switch
        aria-labelledby={`${id}-label`}
        aria-describedby={`${id}-description`}
        checked={checked}
        onCheckedChange={onCheckedChange}
      />
    </div>
  );
}

function SettingsSelectRow({
  id,
  description,
  value,
  disabled,
  onValueChange,
}: {
  id: string;
  description: string;
  value: string;
  disabled: boolean;
  onValueChange: (value: string) => void;
}) {
  return (
    <div className='flex items-center justify-between gap-6 py-4'>
      <div className='min-w-0'>
        <p id={`${id}-label`} className='text-sm font-medium text-foreground'>Max concurrent generations</p>
        <p id={`${id}-description`} className='mt-1 text-xs leading-5 text-muted-foreground'>
          {description}
          {disabled ? ' Applies when concurrent generation is enabled.' : ''}
        </p>
      </div>
      <Select value={value} onValueChange={onValueChange} disabled={disabled}>
        <SelectTrigger
          size='sm'
          className='w-20'
          aria-labelledby={`${id}-label`}
          aria-describedby={`${id}-description`}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {[1, 2, 3, 4, 5].map((maximum) => (
            <SelectItem key={maximum} value={String(maximum)}>{maximum}</SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
