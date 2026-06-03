import { useMemo, type ReactNode } from 'react';
import { AudioLines, Film, Image as ImageIcon } from 'lucide-react';
import type {
  ShotVideoTakeParameterReport,
  ShotVideoTakeParameterValue,
  ShotVideoTakePreflightInputItem,
  ShotVideoTakePreflightReport,
} from '@gorenku/studio-core/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from '@/ui/dialog';
import { Button } from '@/ui/button';
import { cn } from '@/lib/utils';
import { SceneShotAiProductionInputPicker } from './scene-shot-ai-production-input-picker';
import { formatEstimateUsd } from './shot-video-take-production-projection';
import type { ShotVideoTakeInputSlot } from '@/services/studio-shot-video-takes-api';

type ReferenceStatus = 'ready' | 'available' | 'needed';

const DEPENDENCY_KIND_LABELS: Record<string, string> = {
  'first-frame': 'First frame',
  'last-frame': 'Last frame',
  'shot-reference-sheet': 'Reference sheet',
  'multi-shot-storyboard-sheet': 'Storyboard sheet',
  'reference-audio': 'Audio',
  'source-video-extract': 'Source video',
};

interface SceneShotVideoTakePreflightDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  preflight: ShotVideoTakePreflightReport | null;
  modelLabel?: string;
  parameters: ShotVideoTakeParameterReport[];
  previewLoading: boolean;
  onReuse: (inputId: string) => void;
  onRegenerate: (slot: ShotVideoTakeInputSlot) => void;
}

export function SceneShotVideoTakePreflightDialog({
  open,
  onOpenChange,
  preflight,
  modelLabel,
  parameters,
  previewLoading,
  onReuse,
  onRegenerate,
}: SceneShotVideoTakePreflightDialogProps) {
  const items = useMemo(() => {
    if (!preflight) return [];
    // Sorted ready → needed so prepared inputs lead the grid.
    return preflight.inputPlanItems
      .map((item, index) => ({ item, index }))
      .sort((a, b) => {
        const rank = (status: ReferenceStatus) => (status === 'needed' ? 1 : 0);
        return rank(a.item.status) - rank(b.item.status) || a.index - b.index;
      })
      .map((entry) => entry.item);
  }, [preflight]);
  const total = preflight?.plan?.estimate.estimatedTotalUsd ??
    preflight?.estimate?.estimatedCostUsd ??
    null;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='flex max-h-[85vh] w-[80vw] max-w-5xl flex-col gap-0 p-0'>
        <DialogHeader className='pr-12'>
          <DialogTitle>Preview Take Plan</DialogTitle>
          {modelLabel ? (
            <DialogDescription className='truncate text-[11px]'>
              {modelLabel}
            </DialogDescription>
          ) : (
            <DialogDescription className='sr-only'>
              The complete set of inputs for the shot video take.
            </DialogDescription>
          )}
        </DialogHeader>

        {!preflight ? (
          <div className='px-6 py-10 text-sm text-muted-foreground'>
            {previewLoading ? 'Preparing…' : 'No plan yet.'}
          </div>
        ) : (
          <div className='min-h-0 flex-1 space-y-7 overflow-y-auto px-6 py-5'>
            <PromptsSection preflight={preflight} />

            <section>
              <SectionHeading>References</SectionHeading>
              {items.length === 0 ? (
                <p className='text-xs text-muted-foreground'>No inputs required.</p>
              ) : (
                <div className='grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4'>
                  {items.map((item) => (
                    <InputCard
                      key={item.key}
                      item={item}
                      onReuse={onReuse}
                      onRegenerate={onRegenerate}
                    />
                  ))}
                </div>
              )}
            </section>

            <ParametersSection
              parameters={parameters}
              values={preflight.productionGroup.videoTakeProduction.parameterValues ?? {}}
            />
          </div>
        )}

        <DialogFooter className='items-center justify-between'>
          {preflight ? (
            <CostSummary preflight={preflight} total={total} />
          ) : (
            <span />
          )}
          <Button
            type='button'
            variant='outline'
            size='sm'
            onClick={() => onOpenChange(false)}
          >
            Close
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function SectionHeading({ children }: { children: ReactNode }) {
  return (
    <h4 className='mb-2 text-[10px] font-semibold uppercase tracking-[0.16em] text-muted-foreground'>
      {children}
    </h4>
  );
}

function StatusBadge({ status }: { status: ReferenceStatus }) {
  const label =
    status === 'ready' ? 'Ready' : status === 'available' ? 'Available' : 'Needed';
  return (
    <span
      className={cn(
        'rounded-full px-2 py-0.5 text-[9px] font-semibold uppercase tracking-[0.1em] text-white shadow-sm',
        status === 'ready'
          ? 'bg-emerald-500'
          : status === 'available'
            ? 'bg-sky-500'
            : 'bg-amber-500/80'
      )}
    >
      {label}
    </span>
  );
}

function InputCard({
  item,
  onReuse,
  onRegenerate,
}: {
  item: ShotVideoTakePreflightInputItem;
  onReuse: (inputId: string) => void;
  onRegenerate: (slot: ShotVideoTakeInputSlot) => void;
}) {
  const Icon =
    item.mediaKind === 'audio'
      ? AudioLines
      : item.mediaKind === 'video'
        ? Film
        : ImageIcon;
  return (
    <div className='flex flex-col gap-2 rounded-lg border border-border/50 bg-card/40 p-2.5'>
      <span className='relative block aspect-video w-full overflow-hidden rounded-md border border-border/40 bg-muted/40'>
        {item.url ? (
          <img src={item.url} alt='' loading='lazy' className='h-full w-full object-cover' />
        ) : (
          <span className='flex h-full w-full items-center justify-center text-muted-foreground/30'>
            <Icon className='h-6 w-6' />
          </span>
        )}
        <span className='absolute right-1.5 top-1.5'>
          <StatusBadge status={item.status} />
        </span>
      </span>
      <div className='flex items-start justify-between gap-2'>
        <div className='min-w-0'>
          <p className='truncate text-xs font-medium text-foreground/90'>{item.title}</p>
          <p className='truncate text-[10px] uppercase tracking-[0.1em] text-muted-foreground'>
            {item.caption}
          </p>
        </div>
        {item.status === 'needed' ? (
          <span className='shrink-0 font-mono text-[11px] text-foreground/80'>
            {formatEstimateUsd(item.cost ?? null)}
          </span>
        ) : null}
      </div>
      {item.slot && item.candidates ? (
        <SceneShotAiProductionInputPicker
          candidates={item.candidates}
          selectedInputId={item.selectedInputId ?? null}
          onReuse={onReuse}
          onRegenerate={() => onRegenerate(item.slot!)}
        />
      ) : null}
    </div>
  );
}

function PromptsSection({ preflight }: { preflight: ShotVideoTakePreflightReport }) {
  return (
    <section>
      <SectionHeading>Prompt</SectionHeading>
      {preflight.prompts.length === 0 ? (
        <div className='rounded-lg border border-dashed border-border/50 px-3 py-3 text-xs text-muted-foreground'>
          No prompt drafted yet.
        </div>
      ) : (
        <div className='space-y-2'>
          {preflight.prompts.map((prompt, index) => (
            <div
              key={`${prompt.purpose}-${index}`}
              className='space-y-2 rounded-lg border border-border/50 bg-card/40 p-3'
            >
              <p className='whitespace-pre-wrap text-xs leading-relaxed text-foreground/85'>
                {prompt.prompt}
              </p>
              {prompt.negativePrompt ? (
                <p className='whitespace-pre-wrap border-t border-border/30 pt-2 text-xs leading-relaxed text-muted-foreground'>
                  <span className='font-semibold'>Negative: </span>
                  {prompt.negativePrompt}
                </p>
              ) : null}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}

function formatParameterValue(value: ShotVideoTakeParameterValue | undefined): string {
  if (value === undefined || value === null || value === '') return '—';
  if (typeof value === 'boolean') return value ? 'On' : 'Off';
  if (Array.isArray(value)) return value.length ? value.join(', ') : '—';
  return String(value);
}

function ParametersSection({
  parameters,
  values,
}: {
  parameters: ShotVideoTakeParameterReport[];
  values: Record<string, ShotVideoTakeParameterValue>;
}) {
  if (parameters.length === 0) {
    return null;
  }
  return (
    <section className='w-full sm:w-72'>
      <SectionHeading>Parameters</SectionHeading>
      <div className='overflow-hidden rounded-lg border border-border/50'>
        {parameters.map((parameter, index) => (
          <div
            key={parameter.name}
            className={cn(
              'flex items-center justify-between gap-3 bg-card/30 px-3 py-1.5 text-xs',
              index > 0 && 'border-t border-border/30'
            )}
          >
            <span className='truncate text-muted-foreground'>{parameter.label}</span>
            <span className='font-mono text-foreground/90'>
              {formatParameterValue(values[parameter.name] ?? parameter.defaultValue)}
            </span>
          </div>
        ))}
      </div>
    </section>
  );
}

function costLabel(line: ShotVideoTakePreflightReport['estimateLines'][number]): string {
  if (line.dependencyKind) {
    return DEPENDENCY_KIND_LABELS[line.dependencyKind] ?? 'Dependency';
  }
  return 'Final video take';
}

function CostSummary({
  preflight,
  total,
}: {
  preflight: ShotVideoTakePreflightReport;
  total: number | null;
}) {
  const plan = preflight.plan;
  const planBreakdown = plan?.lines.filter((line) => line.kind !== 'reused-asset') ?? [];
  const legacyBreakdown = preflight.estimateLines.filter(
    (line) => line.estimate?.estimatedCostUsd != null
  );
  const breakdownCount = plan ? planBreakdown.length : legacyBreakdown.length;
  const stateLabel = plan ? estimateStateLabel(plan.estimate.state) : null;
  return (
    <div className='flex min-w-0 items-baseline gap-3'>
      <span className='text-[10px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
        Estimated total
      </span>
      <span className='font-mono text-lg font-semibold leading-none text-foreground'>
        {plan ? formatPlanEstimate(plan.estimate.estimatedTotalUsd, plan.estimate.state) : formatEstimateUsd(total)}
      </span>
      {stateLabel ? (
        <span className='text-[11px] text-muted-foreground'>{stateLabel}</span>
      ) : null}
      {breakdownCount > 1 ? (
        <span className='truncate text-[11px] text-muted-foreground'>
          {plan
            ? planBreakdown.map(planLineCostLabel).join('  ·  ')
            : legacyBreakdown
                .map(
                  (line) =>
                    `${costLabel(line)} ${formatEstimateUsd(line.estimate?.estimatedCostUsd ?? null)}`
                )
                .join('  ·  ')}
        </span>
      ) : null}
    </div>
  );
}

function formatPlanEstimate(
  value: number | null,
  state: 'complete' | 'partial' | 'unavailable'
): string {
  if (state === 'unavailable') {
    return 'Needs plan';
  }
  if (state === 'partial') {
    return `${formatEstimateUsd(value)} + unpriced`;
  }
  return formatEstimateUsd(value);
}

function estimateStateLabel(state: 'complete' | 'partial' | 'unavailable'): string {
  if (state === 'partial') {
    return 'Some lines need override';
  }
  if (state === 'unavailable') {
    return 'Attachment needed';
  }
  return 'Complete';
}

function planLineCostLabel(
  line: NonNullable<ShotVideoTakePreflightReport['plan']>['lines'][number]
): string {
  if (line.pricing.state === 'priced') {
    return `${line.label} ${formatEstimateUsd(line.pricing.estimatedUsd)}`;
  }
  if (line.pricing.state === 'unpriced') {
    return `${line.label} unpriced`;
  }
  return `${line.label} attach needed`;
}
