import { useEffect, useState } from 'react';
import { AlertCircle, Loader2 } from 'lucide-react';
import type { RenkuSetup } from '@gorenku/studio-core/client';
import { ConfiguredStudioApp } from './configured-studio-app';
import { OnboardingScreen } from '@/features/onboarding/onboarding-screen';
import { StudioApiError } from '@/services/studio-api-errors';
import { readRenkuSetup } from '@/services/studio-setup-api';
import { Alert, AlertDescription, AlertTitle } from '@/ui/alert';
import { Button } from '@/ui/button';

type SetupGateState =
  | { status: 'loading' }
  | { status: 'error'; error: Error }
  | { status: 'ready'; setup: RenkuSetup };

export function StudioSetupGate() {
  const [state, setState] = useState<SetupGateState>({ status: 'loading' });

  const load = async () => {
    try {
      setState({ status: 'ready', setup: await readRenkuSetup() });
    } catch (error) {
      setState({
        status: 'error',
        error: error instanceof Error ? error : new Error(String(error)),
      });
    }
  };

  useEffect(() => {
    let cancelled = false;
    void readRenkuSetup().then(
      (setup) => {
        if (!cancelled) {
          setState({ status: 'ready', setup });
        }
      },
      (error: unknown) => {
        if (!cancelled) {
          setState({
            status: 'error',
            error: error instanceof Error ? error : new Error(String(error)),
          });
        }
      }
    );
    return () => {
      cancelled = true;
    };
  }, []);

  if (state.status === 'loading') {
    return (
      <main className='flex min-h-screen items-center justify-center bg-background px-6 text-foreground'>
        <div className='flex items-center gap-3 text-sm text-muted-foreground' role='status'>
          <Loader2 className='h-5 w-5 animate-spin' />
          Preparing Renku Studio…
        </div>
      </main>
    );
  }

  if (state.status === 'error') {
    const suggestion =
      state.error instanceof StudioApiError
        ? state.error.suggestion
        : undefined;
    return (
      <main className='flex min-h-screen items-center justify-center bg-background px-6 text-foreground'>
        <div className='w-full max-w-xl space-y-5'>
          <div>
            <p className='text-sm font-medium text-primary'>Renku Studio</p>
            <h1 className='mt-2 text-2xl font-semibold tracking-tight'>
              Setup could not be loaded
            </h1>
          </div>
          <Alert variant='destructive'>
            <AlertCircle />
            <AlertTitle>{state.error.message}</AlertTitle>
            {suggestion ? (
              <AlertDescription>{suggestion}</AlertDescription>
            ) : null}
          </Alert>
          <Button
            type='button'
            variant='outline'
            onClick={() => {
              setState({ status: 'loading' });
              void load();
            }}
          >
            Retry
          </Button>
        </div>
      </main>
    );
  }

  if (state.setup.status === 'configured') {
    return <ConfiguredStudioApp />;
  }

  return (
    <OnboardingScreen
      setup={state.setup}
      onConfigured={(storageRoot) =>
        setState({
          status: 'ready',
          setup: { status: 'configured', storageRoot },
        })
      }
    />
  );
}
