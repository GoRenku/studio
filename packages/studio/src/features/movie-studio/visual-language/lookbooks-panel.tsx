import { useCallback, useEffect, useState } from 'react';
import { toast } from 'sonner';
import type { LookbookType, LookbooksResource } from '@gorenku/studio-core/client';
import {
  clearLookbookSelection,
  deleteLookbook,
  listLookbooks,
  selectLookbookForType,
} from '@/services/studio-visual-language-api';
import {
  matchesVisualLanguageLookbooksResource,
  useStudioResourceRefresh,
} from '@/hooks/use-studio-resource-refresh';
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

  useStudioResourceRefresh({
    projectName,
    matches: matchesVisualLanguageLookbooksResource,
    onRefresh: () => setResourceRevision((current) => current + 1),
  });

  useEffect(() => {
    void listLookbooks(projectName)
      .then(setResource)
      .catch((error) => toast.error(errorMessage(error)));
  }, [projectName, resourceRevision]);

  const toggleSelection = async (
    lookbookId: string,
    type: LookbookType,
    isSelectedForType: boolean
  ) => {
    try {
      if (isSelectedForType) {
        await clearLookbookSelection(projectName, type);
        toast.success(`${lookbookTypeLabel(type)} Lookbook selection cleared.`);
      } else {
        await selectLookbookForType(projectName, type, lookbookId);
        toast.success(`${lookbookTypeLabel(type)} Lookbook selected.`);
      }
      await reload();
      onLookbooksChange();
    } catch (error) {
      toast.error(errorMessage(error));
    }
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
    <div className='p-4 sm:p-5 lg:p-6'>
      <LookbookCardGrid>
        {resource.lookbooks.map((item) => (
          <LookbookCard
            key={item.lookbook.id}
            projectName={projectName}
            item={item}
            onOpen={() => onOpenLookbook(item.lookbook.id)}
            onToggleSelection={() =>
              toggleSelection(
                item.lookbook.id,
                item.lookbook.type,
                item.isSelectedForType
              )
            }
            onDelete={() => removeLookbook(item.lookbook.id)}
          />
        ))}
      </LookbookCardGrid>
    </div>
  );
}

function lookbookTypeLabel(type: LookbookType): string {
  return type === 'movie' ? 'Movie' : 'Storyboard';
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Lookbooks request failed.';
}
