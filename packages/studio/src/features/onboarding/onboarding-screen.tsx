import { useState } from 'react';
import type { RenkuSetup } from '@gorenku/studio-core/client';
import { ProjectLibraryStep } from './project-library-step';
import { ProviderCredentialsStep } from './provider-credentials-step';

export interface OnboardingScreenProps {
  setup: Extract<RenkuSetup, { status: 'setupRequired' }>;
  onConfigured: (storageRoot: string) => void;
}

export function OnboardingScreen({ setup, onConfigured }: OnboardingScreenProps) {
  const [initializedStorageRoot, setInitializedStorageRoot] = useState<
    string | null
  >(null);

  return (
    <main className='flex min-h-screen items-center justify-center bg-background px-8 py-12 text-foreground'>
      <div className='w-full max-w-3xl'>
        <div className='mb-8 flex items-center justify-between border-b border-border/50 pb-5'>
          <div>
            <p className='text-sm font-semibold tracking-wide text-primary'>Renku</p>
            <p className='mt-1 text-sm text-muted-foreground'>First-run setup</p>
          </div>
          <p className='text-xs font-medium uppercase tracking-[0.18em] text-muted-foreground'>
            {initializedStorageRoot === null
              ? 'Project Library'
              : 'Provider API keys'}
          </p>
        </div>

        {initializedStorageRoot === null ? (
          <ProjectLibraryStep
            recommendedStorageRoot={setup.recommendedStorageRoot}
            onInitialized={setInitializedStorageRoot}
          />
        ) : (
          <ProviderCredentialsStep
            onComplete={() => onConfigured(initializedStorageRoot)}
          />
        )}
      </div>
    </main>
  );
}
