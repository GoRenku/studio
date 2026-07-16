import { useEffect, useState } from 'react';
import type { GenerationReference } from '@gorenku/studio-core/client';
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from '@/ui/dialog';
import { Button } from '@/ui/button';
import { ImageOverlayCard } from '@/ui/image-overlay-card';
import { Input } from '@/ui/input';
import {
  listStudioGenerationReferences,
  type StudioGenerationReferenceCatalogItem,
} from '@/services/studio-generation-references-api';

export interface ReferencePickerCandidate {
  id: string;
  title?: string;
  imageUrl: string | null;
  imageAlt: string;
  selected: boolean;
}

export interface GenericReferencePickerValue {
  reference: GenerationReference;
  label: string;
  mediaKind: 'image' | 'audio' | 'video';
  browserUrl?: string;
}

export function ReferencePickerDialog({
  open,
  onOpenChange,
  title,
  description,
  candidates,
  onChoose,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  description: string;
  candidates: ReferencePickerCandidate[];
  onChoose: (candidateId: string | null) => void | Promise<void>;
}) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-5xl'>
        <DialogHeader>
          <DialogTitle>{title}</DialogTitle>
          <DialogDescription>{description}</DialogDescription>
        </DialogHeader>
        <div className='max-h-[65vh] overflow-y-auto px-5 py-5'>
          <div className='mb-4'>
            <Button
              type='button'
              variant='outline'
              onClick={() => onChoose(null)}
            >
              None
            </Button>
          </div>
          <div className='grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3'>
            {candidates.map((candidate) => (
              <ImageOverlayCard
                key={candidate.id}
                title={candidate.title}
                imageUrl={candidate.imageUrl}
                imageAlt={candidate.imageAlt}
                selected={candidate.selected}
                onOpen={() => onChoose(candidate.id)}
              />
            ))}
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

export function GenericReferencePickerDialog({
  open,
  projectName,
  selected,
  onOpenChange,
  onChange,
}: {
  open: boolean;
  projectName: string;
  selected: GenericReferencePickerValue[];
  onOpenChange: (open: boolean) => void;
  onChange: (references: GenericReferencePickerValue[]) => void | Promise<void>;
}) {
  const [search, setSearch] = useState('');
  const [items, setItems] = useState<StudioGenerationReferenceCatalogItem[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let active = true;
    const timer = window.setTimeout(() => {
      setLoading(true);
      setError(null);
      void listStudioGenerationReferences({
        projectName,
        search: search.trim() || undefined,
        limit: 60,
      }).then((page) => {
        if (!active) return;
        setItems(page.items);
        setNextCursor(page.nextCursor);
      }).catch((nextError) => {
        if (active) {
          setError(nextError instanceof Error ? nextError.message : String(nextError));
        }
      }).finally(() => {
        if (active) setLoading(false);
      });
    }, 250);
    return () => {
      active = false;
      window.clearTimeout(timer);
    };
  }, [open, projectName, search]);

  const loadMore = async () => {
    if (!nextCursor || loading) return;
    setLoading(true);
    setError(null);
    try {
      const page = await listStudioGenerationReferences({
        projectName,
        search: search.trim() || undefined,
        cursor: nextCursor,
        limit: 60,
      });
      setItems((current) => [...current, ...page.items]);
      setNextCursor(page.nextCursor);
    } catch (nextError) {
      setError(nextError instanceof Error ? nextError.message : String(nextError));
    } finally {
      setLoading(false);
    }
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className='max-w-5xl'>
        <DialogHeader>
          <DialogTitle>Project Media</DialogTitle>
          <DialogDescription>
            Add image, audio, or video media as separate generic references.
          </DialogDescription>
        </DialogHeader>
        <div className='space-y-4 px-5 py-5'>
          <Input
            type='search'
            aria-label='Search project media'
            placeholder='Search project media'
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          {error ? (
            <p className='text-sm text-destructive'>{error}</p>
          ) : null}
          <div className='max-h-[55vh] overflow-y-auto'>
            <div className='grid grid-cols-[repeat(auto-fill,minmax(220px,1fr))] gap-3'>
              {items.map((item) => {
                const isSelected = selected.some((value) =>
                  referencesEqual(value.reference, item.reference)
                );
                return (
                  <ImageOverlayCard
                    key={referenceKey(item.reference)}
                    title={item.label}
                    description={mediaKindLabel(item.mediaKind)}
                    imageUrl={item.mediaKind === 'image' ? item.browserUrl : null}
                    imageAlt={item.label}
                    selected={isSelected}
                    onOpen={() => {
                      void onChange(isSelected
                        ? selected.filter((value) =>
                            !referencesEqual(value.reference, item.reference)
                          )
                        : [...selected, {
                            reference: item.reference,
                            label: item.label,
                            mediaKind: item.mediaKind,
                            browserUrl: item.browserUrl,
                          }]);
                    }}
                  />
                );
              })}
            </div>
            {!loading && items.length === 0 ? (
              <p className='py-8 text-center text-sm text-muted-foreground'>
                No project media matches this search.
              </p>
            ) : null}
          </div>
          <div className='flex justify-end gap-2'>
            {nextCursor ? (
              <Button
                type='button'
                variant='outline'
                disabled={loading}
                onClick={() => void loadMore()}
              >
                {loading ? 'Loading...' : 'Load More'}
              </Button>
            ) : null}
            <Button type='button' onClick={() => onOpenChange(false)}>
              Done
            </Button>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}

function referencesEqual(
  left: GenerationReference,
  right: GenerationReference,
): boolean {
  return referenceKey(left) === referenceKey(right);
}

function referenceKey(reference: GenerationReference): string {
  return reference.kind === 'asset-file'
    ? `${reference.assetId}:${reference.assetFileId}`
    : reference.projectRelativePath;
}

function mediaKindLabel(mediaKind: 'image' | 'audio' | 'video'): string {
  return mediaKind[0]!.toUpperCase() + mediaKind.slice(1);
}
