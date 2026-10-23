import { Box } from 'lucide-react';
import { PanelEmptyState } from '@/ui/panel-empty-state';
import { listPropsRequest } from '../agent-request-copy';

export function PropOverviewEmptyState() {
  return (
    <PanelEmptyState
      icon={Box}
      title='No props yet'
      description='Props are the objects that have to look the same from shot to shot.'
      request={listPropsRequest}
    />
  );
}
