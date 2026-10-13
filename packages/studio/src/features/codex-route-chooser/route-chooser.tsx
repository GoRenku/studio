import { useState } from 'react';
import type { RouteChooser as RouteChooserSession, RouteChoiceProviderOption } from '@gorenku/studio-codex/route-choice';
import { CodexPanelNotice } from '@/features/codex-panels/codex-panel-notice';
import { Alert, AlertDescription } from '@/ui/alert';
import { Button } from '@/ui/button';
import { Checkbox } from '@/ui/checkbox';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/ui/select';
import { useRouteChooser } from './use-route-chooser';

function chosenSubject(chooser: RouteChooserSession): string | null {
  const answer = chooser.answer;
  if (answer?.kind !== 'chosen') return null;
  const provider = chooser.providers.find((option) => option.provider === answer.provider);
  const model = provider?.models.find((option) => option.key === answer.model);
  return provider && model ? `${model.name} on ${provider.label}` : null;
}

function defaultModelKey(provider: RouteChoiceProviderOption | undefined): string {
  return (provider?.models.find((model) => model.recommended) ?? provider?.models[0])?.key ?? '';
}

export function RouteChooser() {
  const interaction = useRouteChooser('Renku provider and model chooser', chosenSubject);
  const { chooser } = interaction;
  if (!chooser) {
    return (
      <section className='image-edit p-4'>
        {interaction.error
          ? <Alert variant='destructive'><AlertDescription>{interaction.error}</AlertDescription></Alert>
          : <p role='status' className='m-0 text-sm text-[var(--dd-muted-fg)]'>Loading providers…</p>}
      </section>
    );
  }
  return <ChooserCard key={chooser.choiceId} chooser={chooser} interaction={interaction} />;
}

function ChooserCard(input: { chooser: RouteChooserSession; interaction: ReturnType<typeof useRouteChooser> }) {
  const { chooser, interaction } = input;
  const [providerId, setProviderId] = useState(chooser.preselected?.provider ?? '');
  const [modelKey, setModelKey] = useState(chooser.preselected?.model ?? '');
  const [saveAsLaneDefault, setSaveAsLaneDefault] = useState(false);
  const [dontAskAgain, setDontAskAgain] = useState(!chooser.chooseRouteBeforeGenerating);
  const provider = chooser.providers.find((option) => option.provider === providerId);
  const model = provider?.models.find((option) => option.key === modelKey);
  const disabled = !interaction.connected || interaction.busy;
  const lane = chooser.laneLabel;
  const notice = <CodexPanelNotice error={interaction.error} notificationPending={interaction.notificationPending} busy={interaction.busy} onRetryNotification={() => { void interaction.retryNotification(); }} />;
  const respond = (choice: { kind: 'chosen'; provider: string; model: string } | { kind: 'canceled' }) => {
    void interaction.respond({ choice, saveAsLaneDefault, chooseRouteBeforeGenerating: !dontAskAgain });
  };

  if (chooser.answer?.kind === 'canceled') {
    return <section aria-label='Provider and model' className='image-edit rounded-xl border border-[var(--dd-border)]'>{notice}<p className='m-0 px-4 py-3 text-[13px] text-[var(--dd-muted-fg)]'>Provider and model choice canceled.</p></section>;
  }
  if (chooser.answer?.kind === 'chosen') {
    return (
      <section aria-label='Provider and model' className='image-edit rounded-xl border border-[var(--dd-border)]'>
        {notice}
        <div className='px-4 py-3'>
          <b className='block text-[12.5px]'>{chosenSubject(chooser)}</b>
          <span className='text-[11.5px] text-[var(--dd-muted-fg)]'>Chosen for {lane}</span>
        </div>
      </section>
    );
  }
  return (
    <section aria-label='Choose provider and model' className='image-edit overflow-hidden rounded-xl border border-[var(--dd-border)]'>
      <header className='flex flex-wrap items-baseline gap-2.5 px-[18px] pb-2.5 pt-3.5'>
        <h1 className='m-0 text-sm font-semibold'>Choose provider and model</h1>
        <span className='text-xs text-[var(--dd-muted-fg)]'>{lane}</span>
      </header>
      {notice}
      <div className='grid gap-3 px-[18px] pb-4 pt-1 sm:grid-cols-2'>
        <div className='flex flex-col gap-1.5'>
          <span id='route-provider-label' className='text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--dd-muted-fg)]'>Provider</span>
          <Select value={providerId} disabled={disabled} onValueChange={(next) => { setProviderId(next); setModelKey(defaultModelKey(chooser.providers.find((option) => option.provider === next))); }}>
            <SelectTrigger size='sm' aria-labelledby='route-provider-label'><SelectValue placeholder='Choose a provider' /></SelectTrigger>
            <SelectContent position='popper'>
              {chooser.providers.map((option) => (
                <SelectItem key={option.provider} value={option.provider} disabled={!option.available}>
                  {option.available ? option.label : `${option.label} (API key missing)`}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        <div className='flex flex-col gap-1.5'>
          <span id='route-model-label' className='text-[11px] font-semibold uppercase tracking-[0.08em] text-[var(--dd-muted-fg)]'>Model</span>
          <Select value={modelKey} disabled={disabled || !provider} onValueChange={setModelKey}>
            <SelectTrigger size='sm' aria-labelledby='route-model-label'><SelectValue placeholder='Choose a model' /></SelectTrigger>
            <SelectContent position='popper'>
              {(provider?.models ?? []).map((option) => (
                <SelectItem key={option.key} value={option.key}>{option.recommended ? `${option.name} · Recommended` : option.name}</SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
        {chooser.preselected ? null : (
          <p className='m-0 text-[12px] text-[var(--dd-muted-fg)] sm:col-span-2'>No provider with a saved API key offers a model for {lane}.</p>
        )}
      </div>
      <div className='flex flex-col gap-2 px-[18px] pb-3'>
        <CheckboxRow id='route-save-default' label={`Save as Project default for ${lane}`} checked={saveAsLaneDefault} disabled={disabled} onCheckedChange={setSaveAsLaneDefault} />
        <CheckboxRow id='route-dont-ask' label={`Don't ask which provider and model again for ${lane}`} checked={dontAskAgain} disabled={disabled} onCheckedChange={setDontAskAgain} />
      </div>
      <footer className='flex flex-wrap items-center justify-end gap-2.5 border-t border-[var(--dd-border)] px-[18px] py-3'>
        <Button type='button' variant='outline' size='sm' disabled={disabled} onClick={() => respond({ kind: 'canceled' })}>Cancel</Button>
        <Button type='button' size='sm' disabled={disabled || !provider?.available || !model} onClick={() => model && respond({ kind: 'chosen', provider: providerId, model: model.key })} className='bg-[var(--dd-primary)] font-semibold text-[var(--dd-primary-fg)] hover:bg-[var(--dd-primary)] hover:brightness-105'>Continue</Button>
      </footer>
    </section>
  );
}

function CheckboxRow(input: { id: string; label: string; checked: boolean; disabled: boolean; onCheckedChange: (checked: boolean) => void }) {
  return (
    <div className='flex items-center gap-2'>
      <Checkbox id={input.id} checked={input.checked} disabled={input.disabled} onCheckedChange={(checked) => input.onCheckedChange(checked === true)} />
      <label htmlFor={input.id} className='text-[12.5px]'>{input.label}</label>
    </div>
  );
}
