import { FileText } from 'lucide-react';
import type { Scene, StudioSelection } from '@gorenku/studio-core/client';
import { sceneDisplayLabel } from '../../screenplay/scene-label';
import { StudioSidebarButton } from '../studio-sidebar-button';

export function ScreenplaySceneRow({
  scene,
  selection,
  onSelect,
}: {
  scene: Scene;
  selection: StudioSelection;
  onSelect: (selection: StudioSelection) => void;
}) {
  return (
    <StudioSidebarButton
      active={selection.type === 'scene' && selection.id === scene.id}
      icon={<FileText className='h-4 w-4' />}
      label={sceneDisplayLabel(scene)}
      detail='Scene'
      compact
      onClick={() => onSelect({ type: 'scene', id: scene.id })}
    />
  );
}
