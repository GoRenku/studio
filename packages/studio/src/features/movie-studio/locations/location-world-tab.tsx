import type { StudioAssetResponse } from '@/services/studio-project-contracts';
import { projectAssetFileUrl } from '@/services/studio-project-assets-api';
import { SparkLocationWorldViewer } from './spark-location-world-viewer';

interface LocationWorldTabProps {
  projectName: string;
  world: StudioAssetResponse | null;
}

export function LocationWorldTab({ projectName, world }: LocationWorldTabProps) {
  if (!world) {
    return (
      <div className='flex h-full min-h-[420px] items-center justify-center px-8 text-center'>
        <p className='max-w-md text-sm text-muted-foreground'>
          This location has no selected 3D World yet.
        </p>
      </div>
    );
  }
  const file = world.files.find((candidate) =>
    candidate.role === 'primary' && candidate.mediaKind === 'model'
  );
  if (!file) {
    return (
      <div className='flex h-full min-h-[420px] items-center justify-center px-8 text-center'>
        <p className='max-w-md text-sm text-destructive'>
          The selected 3D World has no viewable model file.
        </p>
      </div>
    );
  }
  return (
    <SparkLocationWorldViewer
      key={`${world.id}:${file.id}`}
      url={projectAssetFileUrl(projectName, world.id, file.id)}
    />
  );
}
