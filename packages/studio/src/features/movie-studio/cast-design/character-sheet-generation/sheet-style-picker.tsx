import { Check } from 'lucide-react';
import { Button } from '@/ui/button';
import { cn } from '@/lib/utils';
import type {
  CharacterSheetStyleId,
  CharacterSheetStyleOption,
} from '../cast-design-types';
import {
  characterSheetInteractiveTileClassName,
  characterSheetSectionClassName,
  characterSheetSectionDescriptionClassName,
  characterSheetSectionHeadingClassName,
} from './character-sheet-generation-styles';

interface SheetStylePickerProps {
  styles: CharacterSheetStyleOption[];
  value: CharacterSheetStyleId;
  onValueChange: (value: CharacterSheetStyleId) => void;
}

export function SheetStylePicker({
  styles,
  value,
  onValueChange,
}: SheetStylePickerProps) {
  return (
    <section className={characterSheetSectionClassName}>
      <div className='mb-3'>
        <h4 className={characterSheetSectionHeadingClassName}>
          Sheet Style
        </h4>
        <p className={characterSheetSectionDescriptionClassName}>
          Select the layout template for the generated character sheet.
        </p>
      </div>
      <div className='grid grid-cols-1 gap-3 min-[1200px]:grid-cols-2'>
        {styles.map((style) => {
          const selected = value === style.id;

          return (
            <Button
              key={style.id}
              type='button'
              onClick={() => onValueChange(style.id)}
              variant='ghost'
              className={cn(
                'group h-auto w-full flex-col items-stretch justify-start gap-0 overflow-hidden whitespace-normal rounded-lg border bg-background/50 p-0 text-left shadow-sm transition hover:border-primary/60 hover:bg-background/70',
                characterSheetInteractiveTileClassName,
                selected
                  ? 'border-primary ring-2 ring-primary/30'
                  : 'border-border/45'
              )}
              aria-pressed={selected}
            >
              <span className='relative block aspect-[16/9] bg-muted/55'>
                <img
                  src={style.lightImageUrl}
                  alt=''
                  className='h-full w-full object-contain dark:hidden'
                />
                <img
                  src={style.darkImageUrl}
                  alt=''
                  className='hidden h-full w-full object-contain dark:block'
                />
                <span
                  className={cn(
                    'absolute right-2 top-2 flex h-5 w-5 items-center justify-center rounded-full border transition',
                    selected
                      ? 'border-primary bg-primary text-primary-foreground opacity-100'
                      : 'border-border/60 bg-background/80 text-transparent opacity-0 group-hover:opacity-100'
                  )}
                >
                  <Check className='h-3.5 w-3.5' />
                </span>
              </span>
              <span className='flex items-center border-t border-border/45 px-3 py-2'>
                <span className='truncate text-xs font-semibold'>
                  {style.label}
                </span>
              </span>
            </Button>
          );
        })}
      </div>
    </section>
  );
}
