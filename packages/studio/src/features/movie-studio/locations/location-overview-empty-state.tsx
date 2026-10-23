import { MapPin } from 'lucide-react';
import { PanelEmptyState } from '@/ui/panel-empty-state';
import { addLocationRequest, createLocationsRequest } from '../agent-request-copy';

export function LocationOverviewEmptyState() {
  return (
    <PanelEmptyState
      icon={MapPin}
      title='No locations yet'
      description='Your agent can find every place the screenplay goes and create a Location for each.'
      request={createLocationsRequest}
      moreRequests={[addLocationRequest]}
    />
  );
}
