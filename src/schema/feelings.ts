import { z } from 'zod';

export const FeelingLexiconEntrySchema = z.object({
  canonical: z.string().min(1),
  synonyms: z.array(z.string().min(1)),
  category: z.string().min(1).optional(),
  description: z.string().min(1).optional()
});
export type FeelingLexiconEntry = z.infer<typeof FeelingLexiconEntrySchema>;

export const FeelingLexiconSchema = z
  .object({
    schemaVersion: z.literal('1.0'),
    entries: z.array(FeelingLexiconEntrySchema)
  })
  .superRefine((lexicon, ctx) => {
    const seen = new Set<string>();
    for (let i = 0; i < lexicon.entries.length; i++) {
      const key = lexicon.entries[i].canonical.toLowerCase();
      if (seen.has(key)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['entries', i, 'canonical'],
          message: `Duplicate canonical feeling "${lexicon.entries[i].canonical}"`
        });
      }
      seen.add(key);
    }
  });
export type FeelingLexicon = z.infer<typeof FeelingLexiconSchema>;
