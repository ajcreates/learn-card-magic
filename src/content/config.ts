import { defineCollection, z } from 'astro:content';

const tutorials = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced']),
    tags: z.array(z.string()),
    duration: z.string(),
    publishedAt: z.string(),
    youtubeId: z.string().optional(),
  }),
});

const blog = defineCollection({
  type: 'content',
  schema: z.object({
    title: z.string(),
    description: z.string(),
    tags: z.array(z.string()),
    publishedAt: z.string(),
    readTime: z.number().optional(),
  }),
});

const videos = defineCollection({
  type: 'data',
  schema: z.object({
    youtubeId: z.string(),
    title: z.string(),
    description: z.string(),
    tags: z.array(z.string()),
    difficulty: z.enum(['beginner', 'intermediate', 'advanced']).optional(),
    viewCount: z.number().optional(),
    publishedAt: z.string(),
    slug: z.string(),
  }),
});

export const collections = { tutorials, blog, videos };
