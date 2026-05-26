import { Trash2 } from 'lucide-react';
import { Button } from '@/ui/button';
import { ImageOverlayCard } from '@/ui/image-overlay-card';
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
} from '@/ui/tooltip';

interface GrabCardProps {
  src: string;
  fileName: string;
  onOpen: () => void;
  onDelete: () => void;
}

export function GrabCard({ src, fileName, onOpen, onDelete }: GrabCardProps) {
  return (
    <ImageOverlayCard
      imageUrl={src}
      imageAlt={`${fileName} inspiration grab`}
      onOpen={onOpen}
      topRightAction={
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              type='button'
              size='icon'
              variant='ghost'
              className='h-7 w-7 text-white/75 hover:bg-destructive/80 hover:text-white'
              aria-label={`Delete ${fileName}`}
              onClick={onDelete}
            >
              <Trash2 className='h-3.5 w-3.5' />
            </Button>
          </TooltipTrigger>
          <TooltipContent>Delete image</TooltipContent>
        </Tooltip>
      }
    />
  );
}
