export type CastMemberId = string;

export interface CastMember {
  id: CastMemberId;
  handle: string;
  name: string;
  role?: string;
  isVoiceOver: boolean;
  age?: number;
  want?: string;
  need?: string;
  arc?: string;
  voiceNotes?: string;
  description?: string;
}
