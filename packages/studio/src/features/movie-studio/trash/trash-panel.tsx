import { useCallback, useEffect, useMemo, useState } from 'react';
import { ArchiveX, RotateCcw } from 'lucide-react';
import { toast } from 'sonner';
import type { TrashItem, TrashListReport } from '@gorenku/studio-core/client';
import {
  listTrash,
  previewEmptyTrash,
  restoreTrashItem,
  runEmptyTrash,
} from '@/services/studio-trash-api';
import { Button } from '@/ui/button';
import { DeleteConfirmDialog } from '@/ui/delete-confirm-dialog';

interface TrashPanelProps {
  projectName: string;
}

export function TrashPanel({ projectName }: TrashPanelProps) {
  const [report, setReport] = useState<TrashListReport | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const [busyItemId, setBusyItemId] = useState<string | null>(null);
  const [isEmptyingTrash, setIsEmptyingTrash] = useState(false);
  const [isEmptyTrashDialogOpen, setIsEmptyTrashDialogOpen] = useState(false);

  const refreshTrash = useCallback(async () => {
    setIsLoading(true);
    try {
      setReport(await listTrash(projectName));
    } catch (error) {
      toast.error('Trash could not be loaded', {
        description: readErrorMessage(error),
      });
    } finally {
      setIsLoading(false);
    }
  }, [projectName]);

  useEffect(() => {
    let cancelled = false;
    void listTrash(projectName)
      .then((nextReport) => {
        if (!cancelled) {
          setReport(nextReport);
        }
      })
      .catch((error) => {
        if (!cancelled) {
          toast.error('Trash could not be loaded', {
            description: readErrorMessage(error),
          });
        }
      })
      .finally(() => {
        if (!cancelled) {
          setIsLoading(false);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [projectName]);

  const items = report?.items ?? [];
  const hasItems = items.length > 0;

  const handleRestore = useCallback(
    async (item: TrashItem) => {
      setBusyItemId(item.id);
      try {
        await restoreTrashItem(projectName, item.id);
        await refreshTrash();
        toast.success('Item restored');
      } catch (error) {
        toast.error('Item could not be restored', {
          description: readErrorMessage(error),
        });
      } finally {
        setBusyItemId(null);
      }
    },
    [projectName, refreshTrash]
  );

  const handleRunEmptyTrash = useCallback(async () => {
    setIsEmptyingTrash(true);
    try {
      const preview = await previewEmptyTrash(projectName);
      const report = await runEmptyTrash(projectName, preview.confirmationToken);
      setIsEmptyTrashDialogOpen(false);
      await refreshTrash();
      toast.success('Trash emptied', {
        description: `Moved ${report.files.length} files into the trash package.`,
      });
    } catch (error) {
      toast.error('Trash could not be emptied', {
        description: readErrorMessage(error),
      });
    } finally {
      setIsEmptyingTrash(false);
    }
  }, [projectName, refreshTrash]);

  const actionLabel = useMemo(() => {
    if (isLoading) {
      return 'Loading';
    }
    if (!hasItems) {
      return 'No discarded items';
    }
    return `${items.length} discarded ${items.length === 1 ? 'item' : 'items'}`;
  }, [hasItems, isLoading, items.length]);

  return (
    <section className='flex h-full min-h-0 flex-col bg-panel-bg'>
      <div className='flex h-[52px] shrink-0 items-center justify-between gap-3 border-b border-border/40 px-4'>
        <div className='min-w-0'>
          <p className='truncate text-sm font-medium'>{actionLabel}</p>
          <p className='truncate text-xs text-muted-foreground'>
            Restore discarded work or package it for final cleanup.
          </p>
        </div>
        <div className='flex shrink-0 items-center gap-2'>
          <DeleteConfirmDialog
            open={isEmptyTrashDialogOpen}
            onOpenChange={setIsEmptyTrashDialogOpen}
            title='Empty Trash?'
            message='This will permanently delete every discarded item and empty the Trash for this project. This cannot be undone.'
            onDelete={handleRunEmptyTrash}
            trigger={
              <Button
                type='button'
                variant='destructive'
                size='sm'
                className='gap-1.5'
                disabled={!hasItems || isEmptyingTrash}
              >
                <ArchiveX className='h-4 w-4' />
                Empty
              </Button>
            }
          />
        </div>
      </div>

      <div className='min-h-0 flex-1 overflow-y-auto p-4'>
        {isLoading ? (
          <div className='flex h-full items-center justify-center text-sm text-muted-foreground'>
            Loading Trash...
          </div>
        ) : items.length === 0 ? (
          <div className='flex h-full items-center justify-center text-sm text-muted-foreground'>
            Trash is empty.
          </div>
        ) : (
          <div className='flex flex-col gap-2'>
            {items.map((item) => (
              <TrashItemRow
                key={item.id}
                item={item}
                busy={busyItemId === item.id}
                onRestore={handleRestore}
              />
            ))}
          </div>
        )}
      </div>
    </section>
  );
}

function TrashItemRow({
  item,
  busy,
  onRestore,
}: {
  item: TrashItem;
  busy: boolean;
  onRestore: (item: TrashItem) => void;
}) {
  return (
    <article className='grid grid-cols-[minmax(0,1fr)_auto] items-center gap-3 rounded-md border border-border/50 bg-background/60 px-3 py-3'>
      <div className='min-w-0'>
        <div className='flex min-w-0 items-center gap-2'>
          <span className='rounded-sm bg-muted px-1.5 py-0.5 text-[11px] font-medium text-muted-foreground'>
            {trashItemKindLabel(item.itemKind)}
          </span>
          <span className='truncate text-sm font-medium'>{item.title}</span>
        </div>
        <div className='mt-1 flex min-w-0 items-center gap-2 text-xs text-muted-foreground'>
          <span className='shrink-0'>{formatDiscardedAt(item.createdAt)}</span>
          {item.originalProjectRelativePath ? (
            <span className='truncate'>{item.originalProjectRelativePath}</span>
          ) : null}
        </div>
      </div>
      <Button
        type='button'
        variant='outline'
        size='sm'
        disabled={busy}
        onClick={() => onRestore(item)}
        className='gap-1.5'
      >
        <RotateCcw className='h-4 w-4' />
        Restore
      </Button>
    </article>
  );
}

function trashItemKindLabel(kind: TrashItem['itemKind']): string {
  switch (kind) {
    case 'asset':
      return 'Asset';
    case 'assetRelationship':
      return 'Asset Link';
    case 'castVoice':
      return 'Cast Voice';
    case 'inspirationFolder':
      return 'Inspiration Folder';
    case 'inspirationImage':
      return 'Inspiration Image';
    case 'lookbookImage':
      return 'Lookbook Image';
    case 'lookbookSheet':
      return 'Lookbook Sheet';
    case 'sceneDialogueAudioTake':
      return 'Dialogue Take';
    case 'sceneShotVideoTake':
      return 'Video Take';
  }
}

function formatDiscardedAt(createdAt: string): string {
  return new Intl.DateTimeFormat(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  }).format(new Date(createdAt));
}

function readErrorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'The operation failed.';
}
