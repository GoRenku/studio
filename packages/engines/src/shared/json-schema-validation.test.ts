import { describe, expect, it } from 'vitest';
import {
  assertValidJsonSchema,
  validateJsonSchema,
} from './json-schema-validation.js';

describe('JSON Schema dialect validation', () => {
  it.each([
    'https://json-schema.org/draft/2020-12/schema',
    undefined,
  ])('honors Draft 2020-12 prefixItems with dialect %s', ($schema) => {
    const schema = {
      ...($schema === undefined ? {} : { $schema }),
      type: 'array',
      prefixItems: [
        { type: 'integer', minimum: 0, maximum: 255 },
        { type: 'integer', minimum: 0, maximum: 255 },
        { type: 'integer', minimum: 0, maximum: 255 },
      ],
      items: false,
      minItems: 3,
    };

    expect(() => validateJsonSchema({
      provider: 'pika',
      model: 'recraft/recraft-4.1/text-to-image',
      schema,
      value: [0, 128, 255],
    })).not.toThrow();
    expect(() => validateJsonSchema({
      provider: 'pika',
      model: 'recraft/recraft-4.1/text-to-image',
      schema,
      value: ['bad', -1, 999],
    })).toThrow(expect.objectContaining({ code: 'ENGINE_REQUEST_INVALID' }));
  });

  it('keeps explicitly declared Draft 7 tuple validation', () => {
    expect(() => validateJsonSchema({
      provider: 'test',
      model: 'draft-7-tuple',
      schema: {
        $schema: 'http://json-schema.org/draft-07/schema#',
        type: 'array',
        items: [{ type: 'integer' }, { type: 'string' }],
        additionalItems: false,
      },
      value: [1, 'valid'],
    })).not.toThrow();
  });

  it('rejects an unsupported declared dialect as invalid metadata', () => {
    expect(() => assertValidJsonSchema({
      provider: 'pika',
      model: 'unsupported-schema',
      schema: {
        $schema: 'https://json-schema.org/draft/2019-09/schema',
        type: 'object',
      },
    })).toThrow(expect.objectContaining({ code: 'ENGINE_METADATA_INVALID' }));
  });
});
