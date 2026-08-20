import { useCallback } from 'react';
import { toast } from 'sonner';
import type { ProjectShellWithHttp } from '@/services/studio-project-contracts';
import {
  clearSelectedProjectCover,
  deleteProjectCoverAsset,
  readProjectCoverAssets,
  selectProjectCoverAsset,
} from '@/services/studio-project-assets-api';
import { readProject } from '@/services/studio-projects-api';
import { Button } from '@/ui/button';
import {
  matchesProjectCoversResource,
  useStudioResourceRefresh,
} from '@/hooks/use-studio-resource-refresh';
import { useSelectableAssetCollection } from '@/hooks/use-selectable-asset-collection';
import { ProjectCoverCards } from './project-cover-cards';

export function ProjectCoversTab({
  project,
  onProjectChange,
}: {
  project: ProjectShellWithHttp;
  onProjectChange: (project: ProjectShellWithHttp) => void;
}) {
  const projectName = project.project.projectName;
  const assets = useSelectableAssetCollection({
    readAssets: useCallback(
      () => readProjectCoverAssets(projectName),
      [projectName]
    ),
    selectCanonicalAsset: useCallback(
      (assetId: string) => selectProjectCoverAsset(projectName, assetId),
      [projectName]
    ),
    clearCanonicalAsset: useCallback(
      () => clearSelectedProjectCover(projectName),
      [projectName]
    ),
    discardAsset: useCallback(
      (assetId: string) => deleteProjectCoverAsset(projectName, assetId),
      [projectName]
    ),
  });
  const {
    collection,
    error,
    loading,
    refresh,
    toggleCanonical,
    remove: removeAsset,
  } = assets;

  useStudioResourceRefresh({
    projectName,
    matches: matchesProjectCoversResource,
    onRefresh: refresh,
  });

  const refreshShell = useCallback(
    async (resourceKeys: string[]) => {
      if (resourceKeys.includes('project-shell')) {
        onProjectChange(await readProject(projectName));
      }
    },
    [onProjectChange, projectName]
  );

  const toggle = useCallback(
    async (asset: Parameters<typeof toggleCanonical>[0]) => {
      try {
        const report = await toggleCanonical(asset);
        await refreshShell(report.resourceKeys);
      } catch (error) {
        toast.error(errorMessage(error));
      }
    },
    [refreshShell, toggleCanonical]
  );

  const remove = useCallback(
    async (asset: Parameters<typeof removeAsset>[0]) => {
      try {
        const report = await removeAsset(asset);
        await refreshShell(report.resourceKeys);
      } catch (error) {
        toast.error(errorMessage(error));
      }
    },
    [refreshShell, removeAsset]
  );

  if (loading && collection.items.length === 0) {
    return <p className='px-4 py-5 text-sm text-muted-foreground'>Loading Project covers...</p>;
  }
  if (error) {
    return (
      <div className='space-y-2 px-4 py-5'>
        <p className='text-sm text-destructive'>{error}</p>
        <Button
          type='button'
          variant='outline'
          size='sm'
          onClick={() => void refresh().catch(() => undefined)}
        >
          Retry
        </Button>
      </div>
    );
  }

  return (
    <div className='min-h-full overflow-y-auto bg-panel-bg px-4 py-5'>
      <ProjectCoverCards
        assets={collection.items}
        selectedAssetId={collection.selectedAssetId}
        onToggleSelected={toggle}
        onDelete={remove}
      />
    </div>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Project Cover request failed.';
}
