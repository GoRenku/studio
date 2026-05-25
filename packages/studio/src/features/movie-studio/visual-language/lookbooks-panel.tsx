import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { LookbooksResource } from '@gorenku/studio-core/client';
import {
  deleteLookbook,
  listLookbooks,
  setActiveLookbook,
} from '@/services/studio-visual-language-api';
import { EmptyState } from './empty-state';
import { LookbookCard } from './lookbook-card';
import { LookbookCardGrid } from './lookbook-card-grid';

interface LookbooksPanelProps {
  projectName: string;
  onOpenLookbook: (lookbookId: string) => void;
  onLookbooksChange: () => void;
}

export function LookbooksPanel({
  projectName,
  onOpenLookbook,
  onLookbooksChange,
}: LookbooksPanelProps) {
  const [resource, setResource] = useState<LookbooksResource | null>(null);
  const [resourceRevision, setResourceRevision] = useState(0);

  const reload = useCallback(async () => {
    setResource(await listLookbooks(projectName));
  }, [projectName]);

  useEffect(() => {
    const handleResourceChanged = (event: Event) => {
      const detail = (event as CustomEvent<StudioResourceChangedDetail>).detail;
      if (!detail || detail.projectName !== projectName) {
        return;
      }
      const hasLookbooksChange = detail.resourceKeys.includes(
        'surface:visual-language:lookbooks'
      );
      if (hasLookbooksChange) {
        setResourceRevision((current) => current + 1);
      }
    };

    window.addEventListener('renku:studio-resource-changed', handleResourceChanged);
    return () => {
      window.removeEventListener('renku:studio-resource-changed', handleResourceChanged);
    };
  }, [projectName]);

  useEffect(() => {
    void listLookbooks(projectName)
      .then(setResource)
      .catch((error) => toast.error(errorMessage(error)));
  }, [projectName, resourceRevision]);

  const setActive = async (lookbookId: string) => {
    await setActiveLookbook(projectName, lookbookId);
    await reload();
    onLookbooksChange();
  };

  const removeLookbook = async (lookbookId: string) => {
    await deleteLookbook(projectName, lookbookId);
    await reload();
    onLookbooksChange();
  };

  if (!resource) {
    return <EmptyState title='Loading Lookbooks.' />;
  }

  if (!resource.lookbooks.length) {
    return <EmptyState title='Use the Renku skill to generate a lookbook.' />;
  }

  return (
    <div className='space-y-4'>
      <div>
        <p className='text-[11px] font-semibold uppercase tracking-[0.12em] text-muted-foreground'>
          Lookbooks
        </p>
        <h2 className='mt-1 text-lg font-semibold'>Generated visual directions</h2>
        {!resource.activeLookbookId ? (
          <p className='mt-2 text-sm text-muted-foreground'>
            No lookbook is active. Generation workflows that require a lookbook
            will ask you to choose one.
          </p>
        ) : null}
      </div>
      <LookbookCardGrid>
        {resource.lookbooks.map((item) => (
          <LookbookCard
            key={item.lookbook.id}
            projectName={projectName}
            item={item}
            onOpen={() => onOpenLookbook(item.lookbook.id)}
            onSetActive={() => setActive(item.lookbook.id)}
            onDelete={() => removeLookbook(item.lookbook.id)}
          />
        ))}
      </LookbookCardGrid>
    </div>
  );
}

interface StudioResourceChangedDetail {
  projectName: string;
  resourceKeys: string[];
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Lookbooks request failed.';
}
