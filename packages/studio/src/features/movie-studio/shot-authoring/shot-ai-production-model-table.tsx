import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { ModelRow } from './shot-ai-production-projection';

interface ShotAiProductionModelTableProps {
  rows: ModelRow[];
  selectedModel: string | undefined;
  onSelectModel: (model: string) => void;
  disabled?: boolean;
}

/**
 * Model table (column 2 of the AI Production tab, 0041). A real table with
 * exactly `Model` and `Duration` columns. Rows select directly.
 */
export function ShotAiProductionModelTable({
  rows,
  selectedModel,
  onSelectModel,
  disabled = false,
}: ShotAiProductionModelTableProps) {
  return (
    <div className='flex min-h-0 flex-col'>
      <h4 className='px-1 pb-2 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
        Model
      </h4>
      <div className='min-h-0 flex-1 overflow-y-auto overflow-x-hidden rounded-lg border border-border/50'>
        <table className='w-full border-collapse text-xs'>
          <colgroup>
            <col />
            <col className='w-[84px]' />
          </colgroup>
          <thead className='sticky top-0 z-10 bg-panel-header-bg'>
            <tr className='border-b border-border/50 text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
              <th scope='col' className='px-3 py-2 text-left font-semibold'>
                Model
              </th>
              <th scope='col' className='px-3 py-2 text-left font-semibold'>
                Duration
              </th>
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const selected = row.modelChoice === selectedModel;
              const select = () => {
                if (!disabled && row.available) onSelectModel(row.modelChoice);
              };
              return (
                <tr
                  key={row.modelChoice}
                  aria-selected={selected}
                  aria-disabled={disabled || !row.available}
                  tabIndex={!disabled && row.available ? 0 : -1}
                  onClick={select}
                  onKeyDown={(event) => {
                    if (event.key === 'Enter' || event.key === ' ') {
                      event.preventDefault();
                      select();
                    }
                  }}
                  className={cn(
                    'h-[38.328125px] border-b border-border/25 outline-none last:border-b-0 focus-visible:ring-1 focus-visible:ring-inset focus-visible:ring-ring',
                    !disabled && row.available
                      ? 'cursor-pointer hover:bg-item-hover-bg'
                      : 'cursor-not-allowed opacity-55',
                    selected && 'bg-primary/12'
                  )}
                >
                  <td className='px-3 py-2.5'>
                    <span className='flex items-center gap-2'>
                      <span
                        className={cn(
                          'flex h-4 w-4 shrink-0 items-center justify-center rounded-full border',
                          selected
                            ? 'border-primary bg-primary text-primary-foreground'
                            : 'border-border/60'
                        )}
                      >
                        {selected ? <Check className='h-2.5 w-2.5' /> : null}
                      </span>
                      <span className='font-medium text-foreground/90'>
                        {row.label}
                      </span>
                    </span>
                  </td>
                  <td className='px-3 py-2.5 text-muted-foreground'>
                    {row.duration}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
