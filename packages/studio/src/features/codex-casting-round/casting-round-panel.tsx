import { useState } from 'react';
import { estimateCastingRoundCost, type CastingRoundCostEstimate, type CastingRoute } from '@gorenku/studio-core/client';
import type { CastingRound, CastingRoundModelOption, CastingRoundProviderOption, CastingRoundReference } from '@gorenku/studio-codex/casting-round';
import { CodexPanelNotice } from '@/features/codex-panels/codex-panel-notice';
import { useCodexAnswerPanel } from '@/features/codex-panels/use-codex-answer-panel';
import { usePanelMediaLibrary, usePanelMediaUrl, type PanelMediaLibrary } from '@/features/codex-panels/use-panel-media';
import { GenerationCostEstimateView } from '@/features/media-generation-request/generation-cost-estimate-view';
import { connectCastingRoundApp, createCastingRoundApp, notifyCastingRound, respondToCastingRound } from '@/services/codex-casting-round';
import { cn } from '@/lib/utils';
import { Alert, AlertDescription } from '@/ui/alert';
import { Button } from '@/ui/button';
import { Checkbox } from '@/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { CountStepper } from './count-stepper';
import {
  answeredSummary,
  chosenProvider,
  clampTotal,
  countsTotal,
  formatUsd,
  splitTotal,
  type RoundCounts,
  type RoundProviders,
} from './round-counts';

const CASTING_ROUND_PANEL = {
  appName: 'Renku casting round',
  resultKey: 'round',
  create: createCastingRoundApp,
  connect: connectCastingRoundApp,
  failures: { opening: 'The Casting round panel could not be opened.', interaction: 'The Casting round interaction failed.' },
};

type RoundInteraction = ReturnType<typeof useCodexAnswerPanel<CastingRound>>;

export function CastingRoundPanel() {
  const interaction = useCodexAnswerPanel<CastingRound>(CASTING_ROUND_PANEL);
  const media = usePanelMediaLibrary(interaction.bridge);
  const { panel } = interaction;
  if (!panel) {
    return (
      <section className='image-edit p-4'>
        {interaction.error
          ? <Alert variant='destructive'><AlertDescription>{interaction.error}</AlertDescription></Alert>
          : <p role='status' className='m-0 text-sm text-[var(--dd-muted-fg)]'>Loading the casting round…</p>}
      </section>
    );
  }
  return <RoundCard key={panel.panelId} round={panel} interaction={interaction} media={media} />;
}

function initialCounts(round: CastingRound): RoundCounts {
  return Object.fromEntries(round.preselected.map((route) => [route.model.key, route.count]));
}

function initialProviders(round: CastingRound): RoundProviders {
  return Object.fromEntries(round.preselected.map((route) => [route.model.key, route.provider]));
}

function RoundCard(input: { round: CastingRound; interaction: RoundInteraction; media: PanelMediaLibrary }) {
  const { round, interaction, media } = input;
  const [counts, setCounts] = useState<RoundCounts>(() => initialCounts(round));
  const [providers, setProviders] = useState<RoundProviders>(() => initialProviders(round));
  const [untickedTotal, setUntickedTotal] = useState(round.initialTotal);
  const [saveAsDefaults, setSaveAsDefaults] = useState(false);
  const modelKeys = round.options.map((option) => option.model.key);
  const tickedKeys = modelKeys.filter((key) => counts[key]);
  const total = tickedKeys.length > 0 ? countsTotal(counts) : untickedTotal;
  const estimate = estimateCastingRoundCost(round.options, tickedRoutes(round, counts, providers));
  const disabled = !interaction.connected || interaction.busy;
  const subject = `${round.castMember.name} · ${round.look.name}`;
  const notice = <CodexPanelNotice error={interaction.error} notificationPending={interaction.notificationPending} busy={interaction.busy} onRetryNotification={() => { void interaction.retryNotification(); }} />;

  const changeTotal = (next: number) => {
    const clamped = clampTotal(next, tickedKeys.length, round.maxCountPerModel);
    if (tickedKeys.length === 0) setUntickedTotal(clamped);
    else setCounts(splitTotal(clamped, tickedKeys));
  };
  const toggle = (option: CastingRoundModelOption, ticked: boolean) => {
    const key = option.model.key;
    const keys = modelKeys.filter((candidate) => candidate === key ? ticked : tickedKeys.includes(candidate));
    setUntickedTotal(total);
    setCounts(splitTotal(clampTotal(total, keys.length, round.maxCountPerModel), keys));
  };
  const respond = (choice: 'generate' | 'canceled') => {
    void interaction.answer(
      (connected, current) => respondToCastingRound(connected, {
        panelId: current.panelId,
        choice: choice === 'canceled' ? { kind: 'canceled' } : { kind: 'generate', routes: tickedRoutes(current, counts, providers), maxConcurrentGenerations: current.maxConcurrentGenerations },
        saveAsCastingDefaults: saveAsDefaults,
      }),
      (connected, answered) => notifyCastingRound(connected, answered, answeredSummary(answered)),
    );
  };

  if (round.answer?.kind === 'canceled') {
    return <section aria-label='Casting round' className='image-edit rounded-xl border border-[var(--dd-border)]'>{notice}<p className='m-0 px-4 py-3 text-[13px] text-[var(--dd-muted-fg)]'>Casting round canceled.</p></section>;
  }
  if (round.answer?.kind === 'generate') {
    return (
      <section aria-label='Casting round' className='image-edit rounded-xl border border-[var(--dd-border)]'>
        {notice}
        <div className='px-4 py-3'>
          <b className='block text-[12.5px]'>{subject}</b>
          <span className='text-[11.5px] text-[var(--dd-muted-fg)]'>{answeredSummary(round)}</span>
        </div>
      </section>
    );
  }
  return (
    <section aria-label='Casting round' className='image-edit flex h-screen min-h-0 flex-col overflow-hidden'>
      <header className='flex flex-wrap items-baseline gap-2.5 px-[18px] pb-2.5 pt-3.5'>
        <h1 className='m-0 text-sm font-semibold'>Casting round</h1>
        <span className='text-xs text-[var(--dd-muted-fg)]'>{subject}</span>
      </header>
      {notice}
      <div className='flex min-h-0 flex-1 flex-col gap-3.5 overflow-y-auto px-[18px] pb-4 pt-1'>
        <Brief lines={round.brief} references={round.references} media={media} />
        <div className='flex flex-wrap items-center gap-2.5'>
          <span className='text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--dd-muted-fg)]'>Candidates</span>
          <CountStepper label='Candidates' value={total} min={Math.max(1, tickedKeys.length)} max={Math.max(1, tickedKeys.length) * round.maxCountPerModel} disabled={disabled} onChange={changeTotal} />
          <span className='text-[12px] text-[var(--dd-muted-fg)]'>split across the models you pick · run {round.maxConcurrentGenerations} at a time</span>
        </div>
        {round.options.length === 0
          ? <p className='m-0 text-[12px] text-[var(--dd-muted-fg)]'>No provider with a saved API key offers an image model.</p>
          : (
            <div className='grid gap-2 sm:grid-cols-2'>
              {round.options.map((option) => (
                <ModelCard
                  key={option.model.key}
                  option={option}
                  provider={chosenProvider(option, providers)}
                  count={counts[option.model.key] ?? 0}
                  max={round.maxCountPerModel}
                  disabled={disabled}
                  onToggle={(ticked) => toggle(option, ticked)}
                  onCount={(count) => setCounts({ ...counts, [option.model.key]: count })}
                  onProvider={(provider) => setProviders({ ...providers, [option.model.key]: provider })}
                />
              ))}
            </div>
          )}
        <EstimateLine estimate={estimate} total={total} ticked={tickedKeys.length > 0} />
        <div className='flex items-center gap-2'>
          <Checkbox id='casting-round-save-defaults' checked={saveAsDefaults} disabled={disabled} onCheckedChange={(checked) => setSaveAsDefaults(checked === true)} />
          <label htmlFor='casting-round-save-defaults' className='text-[12.5px]'>Save these models and counts as this project&apos;s casting defaults</label>
        </div>
      </div>
      <footer className='flex flex-wrap items-center justify-end gap-2.5 border-t border-[var(--dd-border)] px-[18px] py-3'>
        <Button type='button' variant='outline' size='sm' disabled={disabled} onClick={() => respond('canceled')}>Cancel</Button>
        <Button type='button' size='sm' disabled={disabled || tickedKeys.length === 0} onClick={() => respond('generate')} className='bg-[var(--dd-primary)] font-semibold text-[var(--dd-primary-fg)] hover:bg-[var(--dd-primary)] hover:brightness-105'>
          Ask agent to generate {total}
        </Button>
      </footer>
    </section>
  );
}

function Brief(input: { lines: string[]; references: CastingRoundReference[]; media: PanelMediaLibrary }) {
  return (
    <div className='flex flex-col gap-2 rounded-[10px] border border-[var(--dd-border)] bg-[var(--dd-card)] px-3.5 py-3'>
      <span className='text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--dd-muted-fg)]'>What each candidate shows</span>
      <ul className='m-0 flex list-disc flex-col gap-1 pl-4 text-[12.5px]'>
        {input.lines.map((line, index) => <li key={index}>{line}</li>)}
      </ul>
      {input.references.length > 0 ? (
        <div className='flex flex-wrap items-center gap-2'>
          <span className='text-[11.5px] text-[var(--dd-muted-fg)]'>Same person as</span>
          {input.references.map((reference) => <ReferenceThumbnail key={reference.assetFileId} reference={reference} media={input.media} />)}
        </div>
      ) : null}
      <span className='text-[11.5px] text-[var(--dd-muted-fg)]'>Edit the brief in chat</span>
    </div>
  );
}

function ReferenceThumbnail(input: { reference: CastingRoundReference; media: PanelMediaLibrary }) {
  const { url } = usePanelMediaUrl(input.media, input.reference.imageUri);
  return (
    <span className='block aspect-[4/3] w-[84px] overflow-hidden rounded-md border border-[var(--dd-border)] bg-[var(--dd-muted)]'>
      {url ? <img alt='Identity reference' src={url} className='size-full object-cover' /> : null}
    </span>
  );
}

function ModelCard(input: {
  option: CastingRoundModelOption;
  provider: CastingRoundProviderOption;
  count: number;
  max: number;
  disabled: boolean;
  onToggle: (ticked: boolean) => void;
  onCount: (count: number) => void;
  onProvider: (provider: string) => void;
}) {
  const { option, provider, count } = input;
  const id = `casting-model-${option.model.key.replace(/\W+/g, '-')}`;
  return (
    <div className={cn('flex flex-col gap-1.5 rounded-[10px] border border-[var(--dd-border)] bg-[var(--dd-card)] px-3 py-2.5', count > 0 && 'border-[var(--dd-active-border)] bg-[var(--dd-active)]')}>
      <div className='flex items-center gap-2'>
        <Checkbox id={id} checked={count > 0} disabled={input.disabled} onCheckedChange={(checked) => input.onToggle(checked === true)} />
        <label htmlFor={id} className='min-w-0 flex-1 truncate text-[12.5px] font-semibold'>{option.model.name}</label>
        {count > 0 ? <CountStepper label={option.model.name} value={count} min={1} max={input.max} disabled={input.disabled} onChange={input.onCount} /> : null}
      </div>
      {option.providers.length > 1 ? (
        <Select value={provider.provider} disabled={input.disabled} onValueChange={input.onProvider}>
          <SelectTrigger size='sm' aria-label={`${option.model.name} provider`} className='h-7 w-full text-[11.5px]'>
            <SelectValue />
          </SelectTrigger>
          <SelectContent position='popper'>
            {option.providers.map((entry) => (
              <SelectItem key={entry.provider} value={entry.provider}>{entry.providerLabel} · {priceLabel(entry)}</SelectItem>
            ))}
          </SelectContent>
        </Select>
      ) : (
        <span className='text-[11.5px] text-[var(--dd-muted-fg)]'>{provider.providerLabel}</span>
      )}
      <ProviderEstimate provider={provider} />
      {option.note ? <span className='text-[11.5px]'>{option.note}</span> : null}
    </div>
  );
}

function ProviderEstimate({ provider }: { provider: CastingRoundProviderOption }) {
  if (provider.billing === 'hostPlanUsage') return <span className='text-[11.5px] text-[var(--dd-muted-fg)]'>ChatGPT plan</span>;
  if (provider.estimate) return <GenerationCostEstimateView estimate={provider.estimate} label='Per candidate' />;
  return <span className='text-[11.5px] text-[var(--dd-muted-fg)]'>No estimate</span>;
}

function EstimateLine(input: { estimate: CastingRoundCostEstimate; total: number; ticked: boolean }) {
  const { estimate } = input;
  if (!input.ticked) return null;
  return (
    <div className='flex flex-wrap items-baseline justify-between gap-2 text-[12.5px]'>
      <span><EstimateTotal estimate={estimate} total={input.total} /></span>
      {estimate.breakdown.length > 0 ? (
        <span className='font-mono text-[11.5px] text-[var(--dd-muted-fg)]'>{estimate.breakdown.map((entry) => `${entry.name} ${formatUsd(entry.amountUsd)}`).join(' · ')}</span>
      ) : null}
    </div>
  );
}

function EstimateTotal(input: { estimate: CastingRoundCostEstimate; total: number }) {
  const { estimate } = input;
  if (estimate.amountUsd !== null) return <>Estimated <b className='tabular-nums'>{formatUsd(estimate.amountUsd)}</b> for {input.total} images</>;
  if (estimate.hostPlanOnly) return <>Uses your ChatGPT plan instead of a provider charge</>;
  return <>No estimate for {estimate.unpriced.join(', ')}</>;
}

function priceLabel(provider: CastingRoundProviderOption): string {
  if (provider.billing === 'hostPlanUsage') return 'ChatGPT plan';
  return provider.estimate !== null && provider.estimate.amountUsd !== null ? `${formatUsd(provider.estimate.amountUsd, 4)} each` : 'No estimate';
}

function tickedRoutes(round: CastingRound, counts: RoundCounts, providers: RoundProviders): CastingRoute[] {
  return round.options
    .filter((option) => counts[option.model.key])
    .map((option) => ({ provider: chosenProvider(option, providers).provider, model: option.model, count: counts[option.model.key]! }));
}
