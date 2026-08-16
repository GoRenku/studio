import { BookOpen, Layers3 } from 'lucide-react';
import type {
  ScreenplaySection,
} from '@gorenku/studio-core/client';
import { StudioSidebarButton } from '../studio-sidebar-button';

export function ScreenplaySectionRow({
  section,
  sceneCount,
  expanded,
  onToggle,
}: {
  section: ScreenplaySection;
  sceneCount: number;
  expanded: boolean;
  onToggle: () => void;
}) {
  const Icon = section.type === 'act' ? BookOpen : Layers3;
  return (
    <StudioSidebarButton
      active={false}
      icon={<Icon className='h-4 w-4' />}
      label={section.title}
      detail={`${sceneCount} ${sceneCount === 1 ? 'scene' : 'scenes'}`}
      onClick={onToggle}
      disclosure={{
        expanded,
        label: `${expanded ? 'Collapse' : 'Expand'} ${section.title}`,
        onToggle,
      }}
    />
  );
}
