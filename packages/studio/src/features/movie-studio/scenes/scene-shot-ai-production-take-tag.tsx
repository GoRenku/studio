import { Layers } from 'lucide-react';
import { Badge } from '@/ui/badge';

interface SceneShotAiProductionTakeTagProps {
  label: string;
}

/**
 * Quiet, informational tag shown at the far right of the shot-detail tab bar
 * when the selected shot belongs to a multi-shot take.
 */
export function SceneShotAiProductionTakeTag({
  label,
}: SceneShotAiProductionTakeTagProps) {
  return (
    <Badge variant='accent' aria-label={label}>
      <Layers className='h-3 w-3' />
      {label}
    </Badge>
  );
}
