import { z } from 'zod';

export const directionIdentity = z.string().min(1).max(512);

export const lineRangeSchema = z.object({
  start: z.number().int().positive(),
  end: z.number().int().positive(),
}).strict();

export const directionRouteSchema = z.object({
  provider: directionIdentity.describe('Provider id, opaque to the runtime and echoed back on consume.'),
  speechModel: directionIdentity.describe('Exact route id for a single-line Take.'),
  rangeModel: directionIdentity.describe('Exact route id for a multi-line Take.'),
}).strict();

export const directionSpeakerSchema = z.object({
  castMemberId: directionIdentity,
  castVoiceIds: z.array(directionIdentity).min(1).describe('Compatible Cast Voices chosen by the provider Skill.'),
  initialCastVoiceId: directionIdentity,
}).strict();

export const directionUnitIntervalSchema = z.number().min(0).max(1);

export const dialogueDirectionGenerateSchema = z.object({
  sessionId: directionIdentity,
  draft: z.looseObject({ panel: z.enum(['eleven-v4', 'seed-audio']) }),
}).strict();

export const dialogueDirectionTakeSelectSchema = z.object({
  sessionId: directionIdentity,
  takeId: directionIdentity,
  selected: z.boolean(),
}).strict();

export const dialogueDirectionTakeDiscardSchema = z.object({
  sessionId: directionIdentity,
  takeId: directionIdentity,
}).strict();

export const dialogueDirectionConsumeSchema = z.object({
  sessionId: directionIdentity,
  actionId: directionIdentity,
}).strict();

export const dialogueDirectionReportSchema = z.object({
  sessionId: directionIdentity,
  actionId: directionIdentity,
  outcome: z.discriminatedUnion('status', [
    z.object({ status: z.literal('attached'), assetFileId: directionIdentity.describe('Asset File id returned by renku media import.') }).strict(),
    z.object({ status: z.literal('failed'), message: z.string().min(1).max(2000) }).strict(),
  ]),
}).strict();
