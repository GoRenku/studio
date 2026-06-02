import { Layers } from 'lucide-react';
import { Badge } from '@/ui/badge';

interface SceneShotAiProductionGroupTagProps {
  label: string;
}

/**
 * Quiet, informational tag shown at the far right of the shot-detail tab bar
 * when the selected shot belongs to a multi-shot production group (0041).
 */
export function SceneShotAiProductionGroupTag({
  label,
}: SceneShotAiProductionGroupTagProps) {
  return (
    <Badge variant='accent' aria-label={label}>
      <Layers className='h-3 w-3' />
      {label}
    </Badge>
  );
}
