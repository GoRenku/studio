import type { ReactNode } from 'react';
import { cn } from '@/lib/utils';
import { characterSheetFieldLabelClassName } from './character-sheet-generation-styles';

interface CharacterSheetFormFieldProps {
  label: string;
  description?: string;
  children: ReactNode;
  className?: string;
}

export function CharacterSheetFormField({
  label,
  description,
  children,
  className,
}: CharacterSheetFormFieldProps) {
  return (
    <div className={cn('grid gap-2', className)}>
      <div className='grid gap-1'>
        <span className={characterSheetFieldLabelClassName}>{label}</span>
        {description ? (
          <span className='text-xs leading-relaxed text-muted-foreground'>
            {description}
          </span>
        ) : null}
      </div>
      {children}
    </div>
  );
}
