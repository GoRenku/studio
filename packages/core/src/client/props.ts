export type PropId = string;

export interface Prop {
  id: PropId;
  handle: string;
  name: string;
  description?: string;
  visualNotes?: string;
}
