import { Users } from 'lucide-react';
import { PanelEmptyState } from '@/ui/panel-empty-state';
import {
  addCastMemberRequest,
  castMainCharactersRequest,
  castWithPortraitsRequest,
} from '../agent-request-copy';

export function CastOverviewEmptyState() {
  return (
    <PanelEmptyState
      icon={Users}
      title='No cast yet'
      description='Your agent can read the screenplay and create a Cast Member for each character.'
      request={castMainCharactersRequest}
      moreRequests={[addCastMemberRequest, castWithPortraitsRequest]}
    />
  );
}
