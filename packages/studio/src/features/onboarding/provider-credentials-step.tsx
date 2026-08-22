import { useEffect } from 'react';
import { AlertCircle, KeyRound, Loader2 } from 'lucide-react';
import { ProviderCredentialsFields } from '@/features/settings/provider-credentials-fields';
import { useProviderCredentialsDraft } from '@/features/settings/use-provider-credentials-draft';
import { Alert, AlertDescription } from '@/ui/alert';
import { Button } from '@/ui/button';

export interface ProviderCredentialsStepProps {
  onComplete: () => void;
}

export function ProviderCredentialsStep({ onComplete }: ProviderCredentialsStepProps) {
  const controller = useProviderCredentialsDraft();
  const load = controller.load;

  useEffect(() => {
    void load();
  }, [load]);

  const continueSetup = async () => {
    if (!controller.dirty || (await controller.save())) {
      onComplete();
    }
  };

  const showFields = controller.providers.length > 0;

  return (
    <section className='overflow-hidden rounded-2xl border border-border/60 bg-card/50 shadow-xl shadow-black/5'>
      <div className='space-y-7 px-10 py-10'>
        <div className='flex h-12 w-12 items-center justify-center rounded-xl bg-primary/10 text-primary'>
          <KeyRound className='h-6 w-6' />
        </div>
        <div className='max-w-2xl space-y-3'>
          <h1 className='text-3xl font-semibold tracking-tight'>Provider API keys</h1>
          <p className='text-base leading-7 text-muted-foreground'>
            Add the keys Renku will use for media generation, or continue and
            configure them later in Settings.
          </p>
        </div>

        {controller.error ? (
          <Alert variant='destructive'>
            <AlertCircle />
            <AlertDescription>
              <p>{controller.error}</p>
              {!showFields ? (
                <Button
                  type='button'
                  variant='outline'
                  size='sm'
                  disabled={controller.loading}
                  onClick={() => void controller.retry()}
                >
                  Retry
                </Button>
              ) : null}
            </AlertDescription>
          </Alert>
        ) : null}

        {controller.loading && !showFields ? (
          <div className='flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground' role='status'>
            <Loader2 className='h-4 w-4 animate-spin' />
            Loading provider API keys…
          </div>
        ) : showFields ? (
          <ProviderCredentialsFields
            providers={controller.providers}
            draftValues={controller.draftValues}
            disabled={controller.loading || controller.saving}
            autoFocusFirst
            onValueChange={controller.setValue}
          />
        ) : null}
      </div>

      <div className='flex items-center justify-between border-t border-border/50 bg-muted/20 px-10 py-5'>
        <Button
          type='button'
          variant='ghost'
          disabled={controller.saving}
          onClick={onComplete}
        >
          Skip for now
        </Button>
        {showFields ? (
          <Button
            type='button'
            size='lg'
            className='min-w-44 gap-2'
            disabled={
              controller.loading ||
              controller.saving ||
              (controller.dirty && !controller.valid)
            }
            onClick={() => void continueSetup()}
          >
            {controller.saving ? <Loader2 className='h-4 w-4 animate-spin' /> : null}
            {controller.saving
              ? 'Saving…'
              : controller.dirty
                ? 'Save and continue'
                : 'Continue'}
          </Button>
        ) : null}
      </div>
    </section>
  );
}
