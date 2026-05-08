import { Minus, Plus, Sparkles } from 'lucide-react';
import { Button } from '@/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/select';
import { cn } from '@/lib/utils';
import type { CharacterSheetModelId } from '../cast-design-types';
import {
  characterSheetControlClassName,
  characterSheetFieldLabelClassName,
  characterSheetSectionClassName,
} from './character-sheet-generation-styles';

interface CharacterSheetGenerationCommandBarProps {
  model: CharacterSheetModelId;
  modelOptions: CharacterSheetModelId[];
  takeCount: number;
  estimatedCost: number;
  onModelChange: (model: CharacterSheetModelId) => void;
  onTakeCountChange: (takeCount: number) => void;
}

export function CharacterSheetGenerationCommandBar({
  model,
  modelOptions,
  takeCount,
  estimatedCost,
  onModelChange,
  onTakeCountChange,
}: CharacterSheetGenerationCommandBarProps) {
  return (
    <div className='shrink-0 border-t border-border/40 bg-dialog-footer-bg px-5 py-4'>
      <div className='mx-auto flex w-full max-w-[860px] items-stretch justify-center gap-3'>
        <ModelSelectionBox
          model={model}
          modelOptions={modelOptions}
          onModelChange={onModelChange}
          className='w-[210px] shrink-0'
        />

        <div
          className={cn(
            characterSheetSectionClassName,
            'flex shrink-0 items-center gap-3'
          )}
        >
          <CostBox estimatedCost={estimatedCost} />
          <TakeCountStepper
            takeCount={takeCount}
            onTakeCountChange={onTakeCountChange}
          />
          <GenerateButton compact />
        </div>
      </div>
    </div>
  );
}

interface ModelSelectionBoxProps {
  model: CharacterSheetModelId;
  modelOptions: CharacterSheetModelId[];
  onModelChange: (model: CharacterSheetModelId) => void;
  className?: string;
}

function ModelSelectionBox({
  model,
  modelOptions,
  onModelChange,
  className,
}: ModelSelectionBoxProps) {
  return (
    <div className={cn(characterSheetSectionClassName, 'grid gap-2', className)}>
      <span className={characterSheetFieldLabelClassName}>Model Selection</span>
      <Select
        value={model}
        onValueChange={(value) => onModelChange(value as CharacterSheetModelId)}
      >
        <SelectTrigger className={cn('w-full', characterSheetControlClassName)}>
          <SelectValue />
        </SelectTrigger>
        <SelectContent>
          {modelOptions.map((option) => (
            <SelectItem key={option} value={option}>
              {option}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}

interface CostBoxProps {
  estimatedCost: number;
}

function CostBox({ estimatedCost }: CostBoxProps) {
  return (
    <div className='flex h-12 min-w-[78px] flex-col items-center justify-center rounded-lg border border-border/45 bg-muted/35 px-3 text-center shadow-inner'>
      <span className={cn(characterSheetFieldLabelClassName, 'leading-none')}>
        Cost
      </span>
      <p className='mt-1 text-sm leading-none'>
        <span className='font-semibold text-foreground'>
          ${estimatedCost.toFixed(2)}
        </span>
      </p>
    </div>
  );
}

interface GenerateButtonProps {
  compact?: boolean;
}

function GenerateButton({ compact = false }: GenerateButtonProps) {
  return (
    <Button
      type='button'
      className={cn(
        'h-12 shrink-0 gap-2 px-5',
        compact ? 'min-w-28 px-4' : 'min-w-36'
      )}
    >
      <Sparkles className='h-4 w-4' />
      Generate
    </Button>
  );
}

interface TakeCountStepperProps {
  takeCount: number;
  onTakeCountChange: (takeCount: number) => void;
}

function TakeCountStepper({
  takeCount,
  onTakeCountChange,
}: TakeCountStepperProps) {
  const decrement = () => onTakeCountChange(Math.max(1, takeCount - 1));
  const increment = () => onTakeCountChange(Math.min(5, takeCount + 1));

  return (
    <div className='flex h-12 shrink-0 items-center rounded-lg border border-border/45 bg-muted/35 p-1 shadow-inner'>
      <Button
        type='button'
        variant='ghost'
        size='icon'
        className='h-10 w-9 rounded-md text-muted-foreground hover:bg-primary/8 hover:text-primary focus-visible:ring-primary/35'
        onClick={decrement}
        disabled={takeCount <= 1}
        aria-label='Decrease takes'
      >
        <Minus className='h-4 w-4' />
      </Button>
      <div className='flex min-w-12 flex-col items-center justify-center px-2 text-center'>
        <span className='text-base font-semibold leading-none text-foreground'>
          {takeCount}
        </span>
        <span className='mt-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-muted-foreground'>
          Takes
        </span>
      </div>
      <Button
        type='button'
        variant='ghost'
        size='icon'
        className='h-10 w-9 rounded-md text-muted-foreground hover:bg-primary/8 hover:text-primary focus-visible:ring-primary/35'
        onClick={increment}
        disabled={takeCount >= 5}
        aria-label='Increase takes'
      >
        <Plus className='h-4 w-4' />
      </Button>
    </div>
  );
}
