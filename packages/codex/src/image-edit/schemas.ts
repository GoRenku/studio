import { z } from 'zod';

export const imageEditIdentity = z.string().min(1).max(512);

export const imageEditResolutionSchema = z.enum(['1k', '2k', '4k']);

export const imageEditRouteSchema = z.object({
  provider: imageEditIdentity.describe('Provider id, opaque to the runtime and echoed back on consume.'),
  model: imageEditIdentity.describe('Exact route id to execute.'),
}).strict();

export const imageEditRegionBoxSchema = z.object({
  top: z.number().int(),
  left: z.number().int(),
  bottom: z.number().int(),
  right: z.number().int(),
}).strict();

export const imageEditGenerateSchema = z.object({
  sessionId: imageEditIdentity,
  draft: z.looseObject({ panel: z.enum(['flux-3']) }),
}).strict();

export const imageEditConsumeSchema = z.object({
  sessionId: imageEditIdentity,
  actionId: imageEditIdentity,
}).strict();

export const imageEditReportSchema = z.object({
  sessionId: imageEditIdentity,
  actionId: imageEditIdentity,
  outcome: z.discriminatedUnion('status', [
    z.object({ status: z.literal('attached'), assetFileId: imageEditIdentity.describe('Asset File id returned by renku media import.') }).strict(),
    z.object({ status: z.literal('failed'), message: z.string().min(1).max(2000) }).strict(),
  ]),
}).strict();
