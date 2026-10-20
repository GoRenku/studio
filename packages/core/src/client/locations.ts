import type { LocationDescription } from './profile-descriptions/model.js';

export type LocationId = string;

export interface Location {
  id: LocationId;
  handle: string;
  name: string;
  timePeriod?: string;
  description?: LocationDescription;
  visualNotes?: string;
}
