import type { PropDescription } from './profile-descriptions/model.js';

export type PropId = string;

export interface Prop {
  id: PropId;
  handle: string;
  name: string;
  description?: PropDescription;
  visualNotes?: string;
}
