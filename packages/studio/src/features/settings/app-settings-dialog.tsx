import { useEffect, useRef, useState, type FormEvent, type ReactElement, type RefObject } from 'react';
import { AlertCircle, Loader2, Settings } from 'lucide-react';
import { toast } from 'sonner';
import { Alert, AlertDescription } from '@/ui/alert';
import { Button } from '@/ui/button';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/ui/dialog';
import { ProviderCredentialsFields } from './provider-credentials-fields';
import { TelemetryChoiceFields } from './telemetry-choice-fields';
import { TelemetryInstallId } from './telemetry-install-id';
import { useProviderCredentialsDraft } from './use-provider-credentials-draft';
import { useTelemetryChoiceDraft } from './use-telemetry-choice-draft';

export function AppSettingsDialog({ trigger, onClose, returnFocusRef }: {
  trigger?: ReactElement;
  onClose?: () => void;
  returnFocusRef?: RefObject<HTMLButtonElement | null>;
}) {
  const handlesSettingsLink = trigger === undefined;
  const [open, setOpen] = useState(
    () => handlesSettingsLink && new URL(window.location.href).searchParams.get('settings') === 'provider-credentials'
  );
  const dialogContentRef = useRef<HTMLDivElement>(null);
  const controller = useProviderCredentialsDraft();
  const usageStatistics = useTelemetryChoiceDraft();
  const loadCredentials = controller.load;
  const loadUsageStatistics = usageStatistics.load;
  const saving = controller.saving || usageStatistics.saving;

  useEffect(() => {
    if (handlesSettingsLink && new URL(window.location.href).searchParams.get('settings') === 'provider-credentials') {
      void loadCredentials();
      void loadUsageStatistics();
    }
  }, [handlesSettingsLink, loadCredentials, loadUsageStatistics]);

  const clearSettingsLink = () => {
    const url = new URL(window.location.href);
    if (url.searchParams.get('settings') !== 'provider-credentials') {
      return;
    }
    url.searchParams.delete('settings');
    window.history.replaceState(window.history.state, '', `${url.pathname}${url.search}${url.hash}`);
  };

  const handleOpenChange = (nextOpen: boolean) => {
    if (saving) {
      return;
    }
    if (nextOpen) {
      setOpen(true);
      void controller.load();
      void usageStatistics.load();
      return;
    }
    controller.resetDraft();
    usageStatistics.resetDraft();
    setOpen(false);
    clearSettingsLink();
    onClose?.();
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (controller.dirty && !(await controller.save())) {
      return;
    }
    if (usageStatistics.dirty && !(await usageStatistics.save())) {
      return;
    }
    setOpen(false);
    clearSettingsLink();
    onClose?.();
    toast.success('Settings saved.');
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        {trigger ?? <Button
          type='button'
          variant='ghost'
          size='icon'
          className='h-7 w-7 text-muted-foreground'
          aria-label='Open Settings'
        >
          <Settings className='h-4 w-4' />
        </Button>}
      </DialogTrigger>

      <DialogContent
        ref={dialogContentRef}
        className='max-h-[calc(100vh-2rem)] max-w-[660px] gap-0 overflow-hidden p-0'
        showCloseButton={!saving}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          dialogContentRef.current?.focus();
        }}
        onCloseAutoFocus={returnFocusRef ? (event) => {
          event.preventDefault();
          returnFocusRef.current?.focus();
        } : undefined}
        onEscapeKeyDown={(event) =>
          saving && event.preventDefault()
        }
        onPointerDownOutside={(event) =>
          saving && event.preventDefault()
        }
      >
        <form onSubmit={submit} className='flex min-h-0 flex-col'>
          <DialogHeader className='px-8 py-5'>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription className='sr-only'>
              Manage provider API keys and usage statistics.
            </DialogDescription>
          </DialogHeader>

          <div className='min-h-0 flex-1 space-y-8 overflow-y-auto px-8 py-8'>
            <section className='space-y-4'>
              <h3 className='text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground'>
                Provider API keys
              </h3>
              {controller.error ? (
                <Alert variant='destructive'>
                  <AlertCircle />
                  <AlertDescription>
                    <p>{controller.error}</p>
                    {controller.providers.length === 0 ? (
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

              {controller.loading && controller.providers.length === 0 ? (
                <div
                  className='flex min-h-40 items-center justify-center gap-2 text-sm text-muted-foreground'
                  role='status'
                >
                  <Loader2 className='h-4 w-4 animate-spin' />
                  Loading provider API keys…
                </div>
              ) : (
                <ProviderCredentialsFields
                  providers={controller.providers}
                  draftValues={controller.draftValues}
                  disabled={controller.loading || saving}
                  autoFocusFirst
                  onValueChange={controller.setValue}
                />
              )}
            </section>

            <section className='space-y-4'>
              <h3 className='text-xs font-semibold uppercase tracking-[0.14em] text-muted-foreground'>
                Usage statistics
              </h3>
              {usageStatistics.error ? (
                <Alert variant='destructive'>
                  <AlertCircle />
                  <AlertDescription>
                    <p>{usageStatistics.error}</p>
                  </AlertDescription>
                </Alert>
              ) : null}
              <TelemetryChoiceFields
                enabled={usageStatistics.enabled}
                blockedBy={usageStatistics.status?.blockedBy ?? null}
                disabled={usageStatistics.status === null || saving}
                onEnabledChange={usageStatistics.setEnabled}
              />
              {usageStatistics.status?.enabled && usageStatistics.status.installId ? (
                <TelemetryInstallId installId={usageStatistics.status.installId} />
              ) : null}
            </section>
          </div>

          <DialogFooter className='px-8 py-5'>
            <Button
              type='button'
              variant='outline'
              disabled={saving}
              className='h-10 min-w-[88px]'
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type='submit'
              disabled={
                controller.loading ||
                usageStatistics.loading ||
                saving ||
                (!controller.dirty && !usageStatistics.dirty) ||
                (controller.dirty && !controller.valid)
              }
              className='h-10 min-w-[104px] gap-2 disabled:border-border/40 disabled:bg-muted/70 disabled:text-muted-foreground/65 disabled:opacity-100 disabled:shadow-none'
            >
              {saving ? (
                <Loader2 className='h-4 w-4 animate-spin' />
              ) : null}
              {saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
