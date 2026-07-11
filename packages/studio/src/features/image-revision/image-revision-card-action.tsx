import { Pencil } from 'lucide-react';
import { Button } from '@/ui/button';
import { Tooltip, TooltipContent, TooltipTrigger } from '@/ui/tooltip';

interface ImageRevisionCardActionProps {
  onEdit: () => void;
}

export function ImageRevisionCardAction({ onEdit }: ImageRevisionCardActionProps) {
  return (
    <Tooltip>
      <TooltipTrigger asChild>
        <Button
          type='button'
          size='icon'
          variant='secondary'
          className='h-8 w-8 rounded-full border border-white/20 bg-black/60 text-white shadow-sm backdrop-blur-sm hover:bg-black/75 hover:text-white'
          aria-label='Edit image'
          onClick={onEdit}
        >
          <Pencil className='h-3.5 w-3.5' />
        </Button>
      </TooltipTrigger>
      <TooltipContent>Edit image</TooltipContent>
    </Tooltip>
  );
}
