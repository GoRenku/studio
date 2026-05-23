import { Trash2 } from 'lucide-react';
import { Button } from '@/ui/button';
import { VisualLanguageImageCard } from './visual-language-image-card';

interface GrabCardProps {
  src: string;
  fileName: string;
  onDelete: () => void;
}

export function GrabCard({ src, fileName, onDelete }: GrabCardProps) {
  return (
    <div className='group relative'>
      <VisualLanguageImageCard src={src} alt={`${fileName} inspiration grab`} />
      <Button
        type='button'
        size='icon'
        variant='ghost'
        className='absolute bottom-1.5 right-1.5 h-7 w-7 opacity-0 group-hover:opacity-100 group-focus-within:opacity-100'
        aria-label={`Delete ${fileName}`}
        onClick={onDelete}
      >
        <Trash2 className='h-3.5 w-3.5' />
      </Button>
    </div>
  );
}
