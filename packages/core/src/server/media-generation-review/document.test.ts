import { describe, expect, it } from 'vitest';
import { validateMediaGenerationProvenance } from '../assets/generation-provenance.js';
import { parseMediaGenerationReviewDocument } from './document.js';
import { assertSafeMediaGenerationRequest } from './safety.js';

describe('media generation review and provenance documents', () => {
  const review = {
    provider: 'codex',
    model: 'gpt-image-2',
    mediaKind: 'image',
    prompt: 'A stone arch at dusk',
    request: { prompt: 'A stone arch at dusk', references: [{ $file: 'media/reference.png', mimeType: 'image/png', reviewLabel: 'Stone arch reference', promptMention: '@Image1' }] },
  } as const;

  it('accepts the exact small envelope without interpreting provider-native fields', () => {
    expect(parseMediaGenerationReviewDocument(review)).toEqual(review);
    expect(validateMediaGenerationProvenance({ ...review, receipt: { providerJob: { arbitrary: true } } })).toEqual({ ...review, receipt: { providerJob: { arbitrary: true } } });
  });

  it.each([
    [null, 'CORE_MEDIA_GENERATION_REVIEW_INVALID'],
    [{ ...review, extra: true }, 'CORE_MEDIA_GENERATION_REVIEW_INVALID'],
    [{ ...review, request: { value: Number.POSITIVE_INFINITY } }, 'CORE_MEDIA_GENERATION_REVIEW_INVALID'],
  ])('rejects invalid review envelopes', (value, code) => {
    expect(() => parseMediaGenerationReviewDocument(value)).toThrowError(expect.objectContaining({ code }));
  });

  it('enforces bounded JSON depth', () => {
    let request: Record<string, unknown> = {};
    for (let depth = 0; depth < 70; depth += 1) {
      request = { nested: request };
    }
    expect(() => parseMediaGenerationReviewDocument({ ...review, request })).toThrowError(expect.objectContaining({ code: 'CORE_MEDIA_GENERATION_REVIEW_INVALID' }));
  });

  it.each([
    [{ $file: 'media/reference.png' }, 'CORE_MEDIA_GENERATION_REFERENCE_LABEL_INVALID'],
    [{ $file: 'media/reference.png', reviewLabel: 'Reference', promptMention: '' }, 'CORE_MEDIA_GENERATION_REFERENCE_MENTION_INVALID'],
    [{ $file: 'media/reference.png', reviewLabel: 'Reference', unknown: true }, 'CORE_MEDIA_GENERATION_REFERENCE_MARKER_INVALID'],
  ])('rejects invalid local media annotations', (marker, code) => {
    expect(() => parseMediaGenerationReviewDocument({
      ...review,
      request: { image: marker },
    })).toThrowError(expect.objectContaining({ code }));
  });

  it('rejects duplicate authored prompt mentions without inspecting prompt text', () => {
    expect(() => parseMediaGenerationReviewDocument({
      ...review,
      prompt: 'No tokens are required here.',
      request: {
        images: [
          { $file: 'media/one.png', reviewLabel: 'One', promptMention: 'Image 1' },
          { $file: 'media/two.png', reviewLabel: 'Two', promptMention: 'Image 1' },
        ],
      },
    })).toThrowError(expect.objectContaining({
      code: 'CORE_MEDIA_GENERATION_REFERENCE_MENTION_DUPLICATE',
    }));
  });

  it('retains unsigned provider output URLs as opaque receipt facts', () => {
    const provenance = {
      ...review,
      receipt: {
        requestId: 'fal_job_1',
        output: {
          video: {
            url: 'https://v3b.fal.media/files/output.mp4',
            content_type: 'video/mp4',
          },
        },
      },
    };

    expect(validateMediaGenerationProvenance(provenance)).toEqual(provenance);
  });

  it.each([
    [{ apiKey: 'secret' }, 'review'],
    [{ image: '/Users/example/reference.png' }, 'review'],
    [{ image: 'https://storage.googleapis.com/private/image.png' }, 'provenance'],
    [{ image: 'https://example.com/image.png?x-amz-signature=signed' }, 'provenance'],
    [{ image: 'https://user:password@example.com/image.png' }, 'provenance'],
  ] as const)('rejects secret, absolute, and transport values in requests', (request, kind) => {
    expect(() => assertSafeMediaGenerationRequest(request, kind)).toThrowError(expect.objectContaining({
      code: kind === 'review' ? 'CORE_MEDIA_GENERATION_REVIEW_UNSAFE' : 'CORE_MEDIA_GENERATION_PROVENANCE_UNSAFE',
    }));
  });

  it.each([
    'https://example.com/image.png?x-amz-signature=signed',
    'https://user:password@example.com/image.png',
  ])('rejects credential-bearing receipt URL %s', (url) => {
    expect(() => validateMediaGenerationProvenance({
      ...review,
      receipt: { output: { image: { url } } },
    })).toThrowError(expect.objectContaining({
      code: 'CORE_MEDIA_GENERATION_PROVENANCE_UNSAFE',
    }));
  });
});
