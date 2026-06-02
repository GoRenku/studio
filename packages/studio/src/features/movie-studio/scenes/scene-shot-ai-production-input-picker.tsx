import { Button } from '@/ui/button';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/ui/select';

export interface ReusableInputCandidate {
  inputId: string;
  label: string;
}

interface SceneShotAiProductionInputPickerProps {
  candidates: ReusableInputCandidate[];
  selectedInputId: string | null;
  onReuse: (inputId: string) => void;
  onRegenerate: () => void;
}

/**
 * Compact `Reuse` vs `Generate new` choice for a prerequisite input slot with
 * reusable candidates (0041). Lives inside the missing-input cards. No raw
 * asset ids or provider field names.
 */
export function SceneShotAiProductionInputPicker({
  candidates,
  selectedInputId,
  onReuse,
  onRegenerate,
}: SceneShotAiProductionInputPickerProps) {
  const reusing = selectedInputId !== null;
  return (
    <div className='flex items-center gap-2 pt-0.5'>
      <Select value={selectedInputId ?? undefined} onValueChange={onReuse}>
        <SelectTrigger size='sm' className='h-7 flex-1 text-[11px]'>
          <SelectValue placeholder='Reuse an existing input' />
        </SelectTrigger>
        <SelectContent>
          {candidates.map((candidate) => (
            <SelectItem key={candidate.inputId} value={candidate.inputId}>
              {candidate.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
      <Button
        type='button'
        variant={reusing ? 'outline' : 'secondary'}
        size='sm'
        className='h-7 shrink-0 text-[11px]'
        disabled={!reusing}
        onClick={onRegenerate}
      >
        Generate new
      </Button>
    </div>
  );
}
