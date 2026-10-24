import { z } from 'zod';

const wardrobeIdentity = z.string().min(1).max(512);

export const castingWardrobeOpenSchema = z.object({
  project: wardrobeIdentity,
  mode: z.enum(['looks', 'costumes']).describe('looks edits a castLooksPlan; costumes edits a castWardrobePlan.'),
  castMemberId: wardrobeIdentity,
  draft: z.looseObject({}).describe('The castLooksPlan (looks mode) or castWardrobePlan (costumes mode) document the agent proposes.'),
}).strict();

export const castingWardrobeRespondSchema = z.object({
  panelId: wardrobeIdentity,
  choice: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('send'), draft: z.looseObject({}) }).strict(),
    z.object({ kind: z.literal('canceled') }).strict(),
  ]),
}).strict();

export const castingWardrobeConsumeSchema = z.object({ panelId: wardrobeIdentity }).strict();
