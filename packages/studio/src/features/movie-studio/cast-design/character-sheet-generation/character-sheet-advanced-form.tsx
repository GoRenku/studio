import { Dice5 } from 'lucide-react';
import { Button } from '@/ui/button';
import { Input } from '@/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/select';
import { Slider } from '@/ui/slider';
import { Switch } from '@/ui/switch';
import { cn } from '@/lib/utils';
import type {
  CharacterSheetGenerationOptions,
  CharacterSheetModelId,
  CharacterSheetOutputFormat,
  CharacterSheetProviderId,
  CharacterSheetQuality,
  CharacterSheetSize,
  CharacterSheetThinkingLevel,
} from '../cast-design-types';
import { CharacterSheetFormField } from './character-sheet-form-field';
import {
  characterSheetControlClassName,
  characterSheetFieldLabelClassName,
  characterSheetInteractiveTileClassName,
  characterSheetSectionClassName,
  characterSheetSectionDescriptionClassName,
  characterSheetSectionHeadingClassName,
} from './character-sheet-generation-styles';

const sizes: CharacterSheetSize[] = ['1K', '2K', '4K'];
const outputFormats: CharacterSheetOutputFormat[] = ['PNG', 'JPEG', 'WEBP'];
const providers: CharacterSheetProviderId[] = ['fal-ai', 'replicate'];
const qualities: CharacterSheetQuality[] = ['Medium', 'Low', 'High'];
const thinkingLevels: CharacterSheetThinkingLevel[] = ['minimal', 'high'];

interface CharacterSheetAdvancedFormProps {
  options: CharacterSheetGenerationOptions;
  availableModels: CharacterSheetModelId[];
  onProviderChange: (provider: CharacterSheetProviderId) => void;
  onModelChange: (model: CharacterSheetModelId) => void;
  onSizeChange: (size: CharacterSheetSize) => void;
  onOutputFormatChange: (format: CharacterSheetOutputFormat) => void;
  onQualityChange: (quality: CharacterSheetQuality) => void;
  onSeedChange: (seed: string) => void;
  onRandomizeSeed: () => void;
  onSafetyToleranceChange: (value: number) => void;
  onWebSearchChange: (enabled: boolean) => void;
  onThinkingLevelChange: (level: CharacterSheetThinkingLevel) => void;
}

export function CharacterSheetAdvancedForm({
  options,
  availableModels,
  onProviderChange,
  onModelChange,
  onSizeChange,
  onOutputFormatChange,
  onQualityChange,
  onSeedChange,
  onRandomizeSeed,
  onSafetyToleranceChange,
  onWebSearchChange,
  onThinkingLevelChange,
}: CharacterSheetAdvancedFormProps) {
  return (
    <div className='mx-auto w-full max-w-[620px] space-y-5'>
      <section className={characterSheetSectionClassName}>
        <div className='mb-4'>
          <h4 className={characterSheetSectionHeadingClassName}>
            Generation Settings
          </h4>
          <p className={characterSheetSectionDescriptionClassName}>
            Choose the provider, model, size, and output format for this take.
          </p>
        </div>
        <div className='grid gap-4'>
          <CharacterSheetSelectField
            label='Provider'
            value={options.provider}
            values={providers}
            onValueChange={(value) =>
              onProviderChange(value as CharacterSheetProviderId)
            }
          />
          <CharacterSheetSelectField
            label='Model'
            value={options.model}
            values={availableModels}
            onValueChange={(value) =>
              onModelChange(value as CharacterSheetModelId)
            }
          />
        </div>
      </section>

      <section className={characterSheetSectionClassName}>
        <div className='mb-4'>
          <h4 className={characterSheetSectionHeadingClassName}>
            Output Settings
          </h4>
          <p className={characterSheetSectionDescriptionClassName}>
            Set the generated sheet size and file format.
          </p>
        </div>
        <div className='grid gap-4 sm:grid-cols-2'>
          <CharacterSheetSelectField
            label='Size'
            value={options.size}
            values={sizes}
            onValueChange={(value) =>
              onSizeChange(value as CharacterSheetSize)
            }
          />
          <CharacterSheetSelectField
            label='Output Format'
            value={options.outputFormat}
            values={outputFormats}
            onValueChange={(value) =>
              onOutputFormatChange(value as CharacterSheetOutputFormat)
            }
          />
        </div>
      </section>

      <CharacterSheetModelSpecificControls
        options={options}
        onQualityChange={onQualityChange}
        onSeedChange={onSeedChange}
        onRandomizeSeed={onRandomizeSeed}
        onSafetyToleranceChange={onSafetyToleranceChange}
        onWebSearchChange={onWebSearchChange}
        onThinkingLevelChange={onThinkingLevelChange}
      />
    </div>
  );
}

interface CharacterSheetSelectFieldProps {
  label: string;
  value: string;
  values: string[];
  onValueChange: (value: string) => void;
}

function CharacterSheetSelectField({
  label,
  value,
  values,
  onValueChange,
}: CharacterSheetSelectFieldProps) {
  return (
    <CharacterSheetFormField label={label}>
      <Select value={value} onValueChange={onValueChange}>
        <SelectTrigger
          className={cn('w-full', characterSheetControlClassName)}
        >
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {values.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </CharacterSheetFormField>
  );
}

interface CharacterSheetModelSpecificControlsProps {
  options: CharacterSheetGenerationOptions;
  onQualityChange: (quality: CharacterSheetQuality) => void;
  onSeedChange: (seed: string) => void;
  onRandomizeSeed: () => void;
  onSafetyToleranceChange: (value: number) => void;
  onWebSearchChange: (enabled: boolean) => void;
  onThinkingLevelChange: (level: CharacterSheetThinkingLevel) => void;
}

function CharacterSheetModelSpecificControls({
  options,
  onQualityChange,
  onSeedChange,
  onRandomizeSeed,
  onSafetyToleranceChange,
  onWebSearchChange,
  onThinkingLevelChange,
}: CharacterSheetModelSpecificControlsProps) {
  if (options.model === 'gpt-image-2') {
    return (
      <section className={characterSheetSectionClassName}>
        <div className='mb-4'>
          <h4 className={characterSheetSectionHeadingClassName}>
            Model specific properties
          </h4>
          <p className={characterSheetSectionDescriptionClassName}>
            Controls available for the selected model.
          </p>
        </div>
        <CharacterSheetSelectField
          label='Quality'
          value={options.quality}
          values={qualities}
          onValueChange={(value) =>
            onQualityChange(value as CharacterSheetQuality)
          }
        />
      </section>
    );
  }

  if (options.model === 'nano-banana-2' || options.model === 'nano-banana-pro') {
    return (
      <section className={cn(characterSheetSectionClassName, 'space-y-4')}>
        <div>
          <h4 className={characterSheetSectionHeadingClassName}>
            Model specific properties
          </h4>
          <p className={characterSheetSectionDescriptionClassName}>
            Controls available for the selected model.
          </p>
        </div>

        <CharacterSheetFormField label='Seed'>
          <div className='flex gap-2'>
            <Input
              inputMode='numeric'
              value={options.seed}
              onChange={(event) => onSeedChange(event.currentTarget.value)}
              className={characterSheetControlClassName}
            />
            <Button
              type='button'
              variant='secondary'
              className='shrink-0 gap-1.5 hover:border-primary/60 hover:bg-primary/10 hover:text-primary focus-visible:border-primary focus-visible:ring-primary/35'
              onClick={onRandomizeSeed}
            >
              <Dice5 className='h-4 w-4' />
              Random
            </Button>
          </div>
        </CharacterSheetFormField>

        <CharacterSheetFormField label='Safety Tolerance'>
          <div className='grid gap-3'>
            <div className='flex justify-end'>
              <span className='rounded-md border border-border/45 bg-background/35 px-2 py-0.5 text-xs font-medium text-foreground'>
                {options.safetyTolerance}
              </span>
            </div>
            <Slider
              min={1}
              max={5}
              step={1}
              value={[options.safetyTolerance]}
              onValueChange={(value) => onSafetyToleranceChange(value[0] ?? 1)}
              showTicks
              tickCount={5}
            />
          </div>
        </CharacterSheetFormField>

        <div
          className={cn(
            'flex items-center justify-between gap-3 rounded-md border border-border/45 bg-background/25 px-3 py-2 transition-colors',
            characterSheetInteractiveTileClassName
          )}
        >
          <span className={characterSheetFieldLabelClassName}>
            Enable Web Search
          </span>
          <Switch
            checked={options.webSearchEnabled}
            onCheckedChange={onWebSearchChange}
            aria-label='Enable Web Search'
          />
        </div>

        <CharacterSheetSelectField
          label='Thinking Level'
          value={options.thinkingLevel}
          values={thinkingLevels}
          onValueChange={(value) =>
            onThinkingLevelChange(value as CharacterSheetThinkingLevel)
          }
        />
      </section>
    );
  }

  return (
    <section
      className={cn(characterSheetSectionClassName, 'text-sm text-muted-foreground')}
    >
      This model has no additional mock properties.
    </section>
  );
}
