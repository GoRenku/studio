import { useEffect } from 'react';
import { AlertCircle, BarChart3, Loader2 } from 'lucide-react';
import { TelemetryChoiceFields } from '@/features/settings/telemetry-choice-fields';
import { useTelemetryChoiceDraft } from '@/features/settings/use-telemetry-choice-draft';
import { Alert, AlertDescription } from '@/ui/alert';
import { Button } from '@/ui/button';

export interface TelemetryStepProps {
  onComplete: () => void;
}

export function TelemetryStep({ onComplete }: TelemetryStepProps) {
  const controller = useTelemetryChoiceDraft();
  const load = controller.load;

  useEffect(() => {
    void load();
  }, [load]);

  const continueSetup = async () => {
    if (!controller.dirty || (await controller.save())) {
      onComplete();
    }
  };

  return (
    <section className='overflow-hidden rounded-2xl border border-border/60 bg-card/50 shadow-xl shadow-black/5'>
      <div className='space-y-7 px-10 py-10'>
        <div className='flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary'>
          <BarChart3 className='h-6 w-6' />
        </div>
        <div className='max-w-2xl space-y-3'>
          <h1 className='text-3xl font-semibold tracking-tight'>Help improve Renku</h1>
          <p className='text-base leading-7 text-muted-foreground'>
            Renku can send a few usage statistics so we can see which versions
            people run and whether projects and generations work. A random ID
            for this computer links them. Renku never sends your files, file
            paths, prompts, screenplay text, media, API keys or project names.
          </p>
        </div>

        {controller.error ? (
          <Alert variant='destructive'>
            <AlertCircle />
            <AlertDescription>
              <p>{controller.error}</p>
            </AlertDescription>
          </Alert>
        ) : null}

        <TelemetryChoiceFields
          enabled={controller.enabled}
          blockedBy={controller.status?.blockedBy ?? null}
          disabled={controller.status === null || controller.saving}
          onEnabledChange={controller.setEnabled}
          heardAbout={{
            answer: controller.heardAbout,
            onAnswerChange: controller.setHeardAbout,
          }}
        />
      </div>

      <div className='flex justify-end border-t border-border/50 bg-muted/20 px-10 py-5'>
        <Button
          type='button'
          size='lg'
          className='min-w-52 gap-2'
          disabled={controller.loading || controller.saving}
          onClick={() => void continueSetup()}
        >
          {controller.saving ? <Loader2 className='h-4 w-4 animate-spin' /> : null}
          {controller.saving ? 'Saving…' : 'Continue'}
        </Button>
      </div>
    </section>
  );
}
