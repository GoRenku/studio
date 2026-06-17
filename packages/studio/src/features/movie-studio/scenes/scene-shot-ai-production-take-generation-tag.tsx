import { Layers } from 'lucide-react';
import { Badge } from '@/ui/badge';

interface SceneShotAiProductionTakeGenerationTagProps {
  label: string;
}

/**
 * Quiet, informational tag shown at the far right of the shot-detail tab bar
 * when the selected shot belongs to a multi-shot take generation.
 */
export function SceneShotAiProductionTakeGenerationTag({
  label,
}: SceneShotAiProductionTakeGenerationTagProps) {
  return (
    <Badge variant='accent' aria-label={label}>
      <Layers className='h-3 w-3' />
      {label}
    </Badge>
  );
}
