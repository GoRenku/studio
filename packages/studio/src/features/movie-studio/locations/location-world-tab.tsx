import { Box } from 'lucide-react';
import type { StudioAssetFileResponse } from '@/services/studio-project-contracts';
import { PanelEmptyState } from '@/ui/panel-empty-state';
import { locationWorldRequest } from '../agent-request-copy';
import { projectAssetFileUrl } from '@/services/studio-project-assets-api';
import { SparkLocationWorldViewer } from './spark-location-world-viewer';

interface LocationWorldTabProps {
  projectName: string;
  locationName: string;
  world: StudioAssetFileResponse | null;
}

export function LocationWorldTab({ projectName, locationName, world }: LocationWorldTabProps) {
  if (!world) {
    return (
      <PanelEmptyState
        className='h-full'
        icon={Box}
        title='No 3D world yet'
        description='A 3D world lets you look around this location from any angle. Your agent builds it from four reviewed images of the same space.'
        request={locationWorldRequest(locationName)}
      />
    );
  }
  return (
    <SparkLocationWorldViewer
      key={world.id}
      url={projectAssetFileUrl(projectName, world.id)}
    />
  );
}
