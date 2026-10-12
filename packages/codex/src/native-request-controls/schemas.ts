import { z } from 'zod';
import type { NativeRequestControl } from './contracts.js';

const label = z.string().min(1).max(512);

const nativeRequestControlSchema: z.ZodType<NativeRequestControl> = z.lazy(() => z.object({
  key: label, label, description: z.string().optional(),
  kind: z.enum(['text', 'multiline', 'number', 'integer', 'boolean', 'enum', 'multi-enum', 'object', 'array']),
  initialValue: z.json().optional(), required: z.boolean().optional(), nullable: z.boolean().optional(),
  minimum: z.number().finite().optional(), maximum: z.number().finite().optional(), step: z.number().positive().optional(),
  options: z.array(z.object({ value: z.json(), label, description: z.string().optional() }).strict()).optional(),
  properties: z.array(nativeRequestControlSchema).optional(), element: nativeRequestControlSchema.optional(),
}).strict());

export const nativeRequestControlsSchema = z.object({
  groups: z.array(z.object({ label, fields: z.array(nativeRequestControlSchema) }).strict()),
}).strict();
