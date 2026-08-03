export type LocationId = string;

export interface Location {
  id: LocationId;
  handle: string;
  name: string;
  timePeriod?: string;
  description?: string;
  visualNotes?: string;
}
