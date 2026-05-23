import { CheckCircle2 } from 'lucide-react';
import { Button } from '@/ui/button';

interface LookbookActiveControlProps {
  isActive: boolean;
  onSetActive: () => Promise<void>;
}

export function LookbookActiveControl({
  isActive,
  onSetActive,
}: LookbookActiveControlProps) {
  if (isActive) {
    return (
      <span className='inline-flex items-center gap-1 rounded-full border border-border/50 px-2 py-1 text-xs text-muted-foreground'>
        <CheckCircle2 className='h-3.5 w-3.5' />
        Active
      </span>
    );
  }
  return (
    <Button type='button' size='sm' variant='outline' onClick={() => void onSetActive()}>
      Set active
    </Button>
  );
}
