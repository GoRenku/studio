import { BookOpen, Layers3 } from 'lucide-react';
import type {
  ScreenplaySection,
  StudioSelection,
} from '@gorenku/studio-core/client';
import { StudioSidebarButton } from '../studio-sidebar-button';

export function ScreenplaySectionRow({
  section,
  sceneCount,
  expanded,
  onToggle,
  selection,
  onSelect,
}: {
  section: ScreenplaySection;
  sceneCount: number;
  expanded: boolean;
  onToggle: () => void;
  selection: StudioSelection;
  onSelect: (selection: StudioSelection) => void;
}) {
  const Icon = section.type === 'act' ? BookOpen : Layers3;
  return (
    <StudioSidebarButton
      active={selection.type === 'section' && selection.id === section.id}
      icon={<Icon className='h-4 w-4' />}
      label={section.title}
      detail={`${sceneCount} ${sceneCount === 1 ? 'scene' : 'scenes'}`}
      onClick={() => onSelect({ type: 'section', id: section.id })}
      disclosure={{
        expanded,
        label: `${expanded ? 'Collapse' : 'Expand'} ${section.title}`,
        onToggle,
      }}
    />
  );
}
