import { Trash2 } from 'lucide-react';
import { Button } from '@/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/ui/tooltip';
import { VisualLanguageImageCard } from './visual-language-image-card';

interface GrabCardProps {
  src: string;
  fileName: string;
  onOpen: () => void;
  onDelete: () => void;
}

export function GrabCard({ src, fileName, onOpen, onDelete }: GrabCardProps) {
  return (
    <div className='group relative'>
      <VisualLanguageImageCard
        src={src}
        alt={`${fileName} inspiration grab`}
        onOpen={onOpen}
      />
      <Tooltip className='absolute right-1.5 top-1.5 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'>
        <TooltipTrigger asChild>
          <Button
            type='button'
            size='icon'
            variant='ghost'
            className='h-7 w-7 bg-black/50 text-white shadow-sm hover:bg-destructive hover:text-destructive-foreground'
            aria-label={`Delete ${fileName}`}
            onClick={onDelete}
          >
            <Trash2 className='h-3.5 w-3.5' />
          </Button>
        </TooltipTrigger>
        <TooltipContent>Delete image</TooltipContent>
      </Tooltip>
    </div>
  );
}
