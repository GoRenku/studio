import { z } from 'zod';
import { GENERATION_LANES, isMediaPurpose, type MediaPurpose } from '@gorenku/studio-core/client';

const routeChoiceIdentity = z.string().min(1).max(512);

const mediaPurposeSchema = z.string().refine(isMediaPurpose, 'Unknown media purpose.').transform((value) => value as MediaPurpose);

export const routeChooseSchema = z.object({
  project: routeChoiceIdentity,
  purpose: mediaPurposeSchema,
  lane: z.enum(GENERATION_LANES),
  suggested: z.object({
    provider: routeChoiceIdentity,
    model: routeChoiceIdentity.describe('A model key from the Default Model List.'),
  }).strict().optional().describe('Preselect this provider and model instead of the lane default.'),
}).strict();

export const routeRespondSchema = z.object({
  choiceId: routeChoiceIdentity,
  choice: z.discriminatedUnion('kind', [
    z.object({ kind: z.literal('chosen'), provider: routeChoiceIdentity, model: routeChoiceIdentity }).strict(),
    z.object({ kind: z.literal('canceled') }).strict(),
  ]),
  saveAsLaneDefault: z.boolean(),
  chooseRouteBeforeGenerating: z.boolean(),
}).strict();

export const routeConsumeSchema = z.object({ choiceId: routeChoiceIdentity }).strict();
