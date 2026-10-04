import { useCallback } from 'react';
import { toast } from 'sonner';
import type { ProjectShellWithHttp } from '@/services/studio-project-contracts';
import {
  clearSelectedProjectCover,
  deleteProjectCoverAssetFile,
  readProjectCoverAssetFiles,
  selectProjectCoverAssetFile,
} from '@/services/studio-project-assets-api';
import { readProject } from '@/services/studio-projects-api';
import { Button } from '@/ui/button';
import {
  matchesProjectCoversResource,
  useStudioResourceRefresh,
} from '@/hooks/use-studio-resource-refresh';
import { useSelectableAssetFileCollection } from '@/hooks/use-selectable-asset-collection';
import { ProjectCoverCards } from './project-cover-cards';

export function ProjectCoversTab({
  project,
  onProjectChange,
}: {
  project: ProjectShellWithHttp;
  onProjectChange: (project: ProjectShellWithHttp) => void;
}) {
  const projectName = project.project.projectName;
  const assetFiles = useSelectableAssetFileCollection({
    readAssetFiles: useCallback(
      () => readProjectCoverAssetFiles(projectName),
      [projectName]
    ),
    selectCanonicalAssetFile: useCallback(
      (assetFileId: string) => selectProjectCoverAssetFile(projectName, assetFileId),
      [projectName]
    ),
    clearCanonicalAssetFile: useCallback(
      () => clearSelectedProjectCover(projectName),
      [projectName]
    ),
    discardAssetFile: useCallback(
      (assetFileId: string) => deleteProjectCoverAssetFile(projectName, assetFileId),
      [projectName]
    ),
  });
  const {
    collection,
    error,
    loading,
    refresh,
    toggleCanonical,
    remove: removeAssetFile,
  } = assetFiles;

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
    async (assetFile: Parameters<typeof toggleCanonical>[0]) => {
      try {
        const report = await toggleCanonical(assetFile);
        await refreshShell(report.resourceKeys);
      } catch (error) {
        toast.error(errorMessage(error));
      }
    },
    [refreshShell, toggleCanonical]
  );

  const remove = useCallback(
    async (assetFile: Parameters<typeof removeAssetFile>[0]) => {
      try {
        const report = await removeAssetFile(assetFile);
        await refreshShell(report.resourceKeys);
      } catch (error) {
        toast.error(errorMessage(error));
      }
    },
    [refreshShell, removeAssetFile]
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
        assetFiles={collection.items}
        selectedAssetFileId={collection.selectedAssetFileId}
        onToggleSelected={toggle}
        onDelete={remove}
      />
    </div>
  );
}

function errorMessage(error: unknown): string {
  return error instanceof Error ? error.message : 'Project Cover request failed.';
}
