import { z } from 'zod';
import { nativeRequestControlsSchema } from '../native-request-controls/schemas.js';

export const imageEditIdentity = z.string().min(1).max(512);
const imageEditLabel = z.string().trim().min(1).max(200);

/** Purpose-level envelope bounds of an image edit draft; not model facts. */
export const IMAGE_EDIT_MAX_REGIONS = 50;
export const IMAGE_EDIT_MAX_REGION_INSTRUCTION = 2000;
export const IMAGE_EDIT_MAX_WHOLE_IMAGE_INSTRUCTION = 4000;

export const imageEditRouteSchema = z.object({
  provider: imageEditIdentity.describe('Provider id, echoed back on consume.'),
  providerLabel: imageEditLabel,
  model: imageEditIdentity.describe('Exact route id to execute; opaque to the runtime.'),
  label: imageEditLabel.describe('Route index name.'),
  regionModes: z.array(z.object({
    id: z.string().trim().min(1).max(64),
    label: imageEditLabel,
    instructionRequired: z.boolean(),
    placeholder: z.string().max(200),
  }).strict()).nullable().describe('Region actions in display order, the first being the default; null when the route takes no regions.'),
  styleReference: z.boolean().describe('Whether the route takes a style reference image.'),
  controls: nativeRequestControlsSchema.describe('Native Request Controls for the native settings the model guide lists, built from the live schema.'),
}).strict();

export const imageEditRegionBoxSchema = z.object({
  top: z.number().int(),
  left: z.number().int(),
  bottom: z.number().int(),
  right: z.number().int(),
}).strict();

export const imageEditOpenSchema = z.object({
  project: imageEditIdentity,
  sourceAssetFileId: imageEditIdentity.describe('The exact image Asset File to edit.'),
  route: imageEditRouteSchema.describe('Route Description copied from the model guide `## Codex panel` block, with labels and live-schema controls.'),
  initialWholeImageInstruction: z.string().max(IMAGE_EDIT_MAX_WHOLE_IMAGE_INSTRUCTION).describe('Optional prefill from the user request; empty when none.'),
}).strict();

export const imageEditDraftSchema = z.object({
  baseAssetFileId: imageEditIdentity,
  wholeImageInstruction: z.string().max(IMAGE_EDIT_MAX_WHOLE_IMAGE_INSTRUCTION),
  styleReferenceAssetFileId: imageEditIdentity.nullable(),
  regions: z.array(z.object({
    number: z.number().int(),
    mode: z.string(),
    box: imageEditRegionBoxSchema,
    instruction: z.string().max(IMAGE_EDIT_MAX_REGION_INSTRUCTION),
  }).strict()).max(IMAGE_EDIT_MAX_REGIONS),
  values: z.record(z.string(), z.json()),
}).strict();

export const imageEditGenerateSchema = z.object({
  sessionId: imageEditIdentity,
  draft: z.looseObject({}),
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
