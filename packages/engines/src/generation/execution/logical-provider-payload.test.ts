import { describe, expect, it } from 'vitest';
import { buildLogicalProviderPayload } from './logical-provider-payload.js';

describe('logical provider payload construction', () => {
  it('adds logical input file URIs before provider payload validation', async () => {
    const request = {
      payload: {
        prompt: 'Use the source character sheet.',
        num_images: 1,
      },
      inputFiles: [
        {
          field: 'image_urls',
          projectRelativePath: 'cast/ada/character sheets/source image.png',
          mediaKind: 'image' as const,
          asArray: true,
          required: true,
        },
        {
          field: 'image_urls',
          projectRelativePath: 'cast/ada/character sheets/style reference.png',
          mediaKind: 'image' as const,
          asArray: true,
          required: true,
        },
      ],
    };

    expect(buildLogicalProviderPayload(request)).toMatchObject({
      prompt: 'Use the source character sheet.',
      image_urls: [
        'renku-input://cast/ada/character%20sheets/source%20image.png',
        'renku-input://cast/ada/character%20sheets/style%20reference.png',
      ],
    });
  });

  it('rejects duplicate scalar input file fields', () => {
    const request = {
      payload: {},
      inputFiles: [
        {
          field: 'image_url',
          projectRelativePath: 'cast/ada/source.png',
          mediaKind: 'image' as const,
        },
        {
          field: 'image_url',
          projectRelativePath: 'cast/ada/style.png',
          mediaKind: 'image' as const,
        },
      ],
    };

    expect(() => buildLogicalProviderPayload(request)).toThrow(
      /configured as a scalar but the payload already contains a value/
    );
  });

  it('rejects array input file fields when the payload already has a scalar value', () => {
    const request = {
      payload: {
        image_urls: 'renku-input://cast/ada/source.png',
      },
      inputFiles: [
        {
          field: 'image_urls',
          projectRelativePath: 'cast/ada/style.png',
          mediaKind: 'image' as const,
          asArray: true,
        },
      ],
    };

    expect(() => buildLogicalProviderPayload(request)).toThrow(
      /configured as an array but the payload already contains a non-array value/
    );
  });

  it('does not mutate existing array payload when appending input files', () => {
    const existingImageUrls = ['https://example.test/source.png'];
    const request = {
      payload: {
        image_urls: existingImageUrls,
      },
      inputFiles: [
        {
          field: 'image_urls',
          projectRelativePath: 'cast/ada/style.png',
          mediaKind: 'image' as const,
          asArray: true,
        },
      ],
    };

    expect(buildLogicalProviderPayload(request)).toMatchObject({
      image_urls: [
        'https://example.test/source.png',
        'renku-input://cast/ada/style.png',
      ],
    });
    expect(existingImageUrls).toEqual(['https://example.test/source.png']);
  });
});
