import { BookOpen } from 'lucide-react';
import { PanelEmptyState } from '@/ui/panel-empty-state';
import {
  designProductionLookbookRequest,
  designStoryboardLookbookRequest,
} from '../agent-request-copy';

const LOOKBOOK_EMPTY_COPY = {
  production: {
    title: 'No production lookbook yet',
    description: 'The production lookbook holds the visual rules your final video follows.',
    request: designProductionLookbookRequest,
  },
  storyboard: {
    title: 'No storyboard lookbook yet',
    description: 'The storyboard lookbook sets the drawing style for every storyboard frame.',
    request: designStoryboardLookbookRequest,
  },
} as const;

export function LookbookEmptyState({ kind }: { kind: keyof typeof LOOKBOOK_EMPTY_COPY }) {
  const copy = LOOKBOOK_EMPTY_COPY[kind];
  return (
    <PanelEmptyState
      icon={BookOpen}
      title={copy.title}
      description={copy.description}
      request={copy.request}
    />
  );
}
