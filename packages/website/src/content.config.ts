import { defineCollection } from 'astro:content';
import { glob } from 'astro/loaders';
import { z } from 'astro/zod';

import { releaseNotesLoader } from './content/release-notes-loader';

const journal = defineCollection({
  loader: glob({ pattern: '*.md', base: './src/content/journal' }),
  schema: ({ image }) =>
    z
      .object({
        title: z.string().min(1),
        description: z.string().min(1),
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Use a YYYY-MM-DD date'),
        cover: image().optional(),
        coverAlt: z.string().min(1).optional(),
        coverCaption: z.string().min(1).optional(),
      })
      .refine((post) => !post.cover || Boolean(post.coverAlt), 'A cover image needs coverAlt'),
});

const releaseNotes = defineCollection({
  loader: releaseNotesLoader(),
  schema: z.object({
    version: z.string().regex(/^\d+\.\d+\.\d+$/),
    date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
    url: z.url(),
    prerelease: z.boolean(),
  }),
});

export const collections = { journal, releaseNotes };
