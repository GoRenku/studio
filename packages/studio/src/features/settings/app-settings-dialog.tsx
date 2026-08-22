import { useRef, useState, type FormEvent } from 'react';
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
import { useProviderCredentialsDraft } from './use-provider-credentials-draft';

export function AppSettingsDialog() {
  const [open, setOpen] = useState(false);
  const dialogContentRef = useRef<HTMLDivElement>(null);
  const controller = useProviderCredentialsDraft();

  const handleOpenChange = (nextOpen: boolean) => {
    if (controller.saving) {
      return;
    }
    if (nextOpen) {
      setOpen(true);
      void controller.load();
      return;
    }
    controller.resetDraft();
    setOpen(false);
  };

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (await controller.save()) {
      setOpen(false);
      toast.success('Settings saved.');
    }
  };

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          type='button'
          variant='ghost'
          size='icon'
          className='h-7 w-7 text-muted-foreground'
          aria-label='Open Settings'
        >
          <Settings className='h-4 w-4' />
        </Button>
      </DialogTrigger>

      <DialogContent
        ref={dialogContentRef}
        className='max-h-[calc(100vh-2rem)] max-w-[660px] gap-0 overflow-hidden p-0'
        showCloseButton={!controller.saving}
        onOpenAutoFocus={(event) => {
          event.preventDefault();
          dialogContentRef.current?.focus();
        }}
        onEscapeKeyDown={(event) =>
          controller.saving && event.preventDefault()
        }
        onPointerDownOutside={(event) =>
          controller.saving && event.preventDefault()
        }
      >
        <form onSubmit={submit} className='flex min-h-0 flex-col'>
          <DialogHeader className='px-8 py-5'>
            <DialogTitle>Settings</DialogTitle>
            <DialogDescription className='sr-only'>
              Manage provider API keys.
            </DialogDescription>
          </DialogHeader>

          <div className='min-h-0 flex-1 overflow-y-auto px-8 py-8'>
            <div className='space-y-4'>
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
                  disabled={controller.loading || controller.saving}
                  autoFocusFirst
                  onValueChange={controller.setValue}
                />
              )}
            </div>
          </div>

          <DialogFooter className='px-8 py-5'>
            <Button
              type='button'
              variant='outline'
              disabled={controller.saving}
              className='h-10 min-w-[88px]'
              onClick={() => handleOpenChange(false)}
            >
              Cancel
            </Button>
            <Button
              type='submit'
              disabled={
                controller.loading ||
                controller.saving ||
                !controller.dirty ||
                !controller.valid
              }
              className='h-10 min-w-[104px] gap-2 disabled:border-border/40 disabled:bg-muted/70 disabled:text-muted-foreground/65 disabled:opacity-100 disabled:shadow-none'
            >
              {controller.saving ? (
                <Loader2 className='h-4 w-4 animate-spin' />
              ) : null}
              {controller.saving ? 'Saving…' : 'Save'}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
