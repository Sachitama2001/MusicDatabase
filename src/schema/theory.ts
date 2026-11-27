import { z } from 'zod';

export const TheorySourceSchema = z.object({
  title: z.string().min(1),
  author: z.string().min(1).optional(),
  url: z.string().url().optional(),
  published: z.string().min(1).optional(),
  updated: z.string().min(1).optional(),
  accessed: z.string().min(1).optional()
});
export type TheorySource = z.infer<typeof TheorySourceSchema>;

export const ReviewStatusSchema = z.enum(['approved', 'pending', 'merged']);
export type ReviewStatus = z.infer<typeof ReviewStatusSchema>;

export const ConfidenceSchema = z.enum(['high', 'medium', 'low']);

export const ProgressionRecordSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  degrees: z.array(z.string()).nullable().optional(),
  exampleKey: z.string().min(1).nullable().optional(),
  example: z.array(z.string().min(1)).default([]),
  tags: z.array(z.string().min(1)).default([]),
  harmonicRhythm: z.string().nullable().optional(),
  evidence_type: z.string().min(1),
  confidence: ConfidenceSchema,
  review_status: ReviewStatusSchema.optional(),
  source: TheorySourceSchema.optional(),
  notes: z.string().optional()
});
export type ProgressionRecord = z.infer<typeof ProgressionRecordSchema>;

export const HarmonyTechniqueSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  summary: z.string().min(1),
  tags: z.array(z.string().min(1)).default([]),
  before: z.array(z.string().min(1)).default([]),
  after: z.array(z.string().min(1)).default([]),
  useWhen: z.string().optional(),
  caution: z.string().optional(),
  evidence_type: z.string().min(1),
  confidence: ConfidenceSchema,
  review_status: ReviewStatusSchema.optional(),
  source: TheorySourceSchema.optional(),
  related_sources: z.array(TheorySourceSchema).optional(),
  notes: z.string().optional()
});
export type HarmonyTechnique = z.infer<typeof HarmonyTechniqueSchema>;

export const StyleMoodSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  tags: z.array(z.string().min(1)).default([]),
  harmonyTendencies: z.array(z.string().min(1)).default([]),
  arrangementTendencies: z.array(z.string().min(1)).default([]),
  evidence_type: z.string().min(1),
  confidence: ConfidenceSchema,
  review_status: ReviewStatusSchema.optional(),
  source: TheorySourceSchema.optional(),
  notes: z.string().optional()
});
export type StyleMood = z.infer<typeof StyleMoodSchema>;

export const CompositionRuleSchema = z.object({
  id: z.string().min(1),
  name: z.string().min(1),
  rule: z.string().min(1),
  priority: z.enum(['hard', 'soft']),
  evidence_type: z.string().min(1),
  review_status: ReviewStatusSchema.optional(),
  source: TheorySourceSchema.optional(),
  notes: z.string().optional()
});
export type CompositionRule = z.infer<typeof CompositionRuleSchema>;

function ensureUniqueIds<T extends { id: string }>(
  items: T[],
  ctx: z.RefinementCtx,
  label: string
): void {
  const seen = new Set<string>();
  for (let i = 0; i < items.length; i++) {
    if (seen.has(items[i].id)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: [i, 'id'],
        message: `Duplicate ${label} id "${items[i].id}"`
      });
    }
    seen.add(items[i].id);
  }
}

export const ProgressionLibrarySchema = z
  .array(ProgressionRecordSchema)
  .superRefine((items, ctx) => ensureUniqueIds(items, ctx, 'progression'));

export const HarmonyTechniqueLibrarySchema = z
  .array(HarmonyTechniqueSchema)
  .superRefine((items, ctx) => ensureUniqueIds(items, ctx, 'harmony-technique'));

export const StyleMoodLibrarySchema = z
  .array(StyleMoodSchema)
  .superRefine((items, ctx) => ensureUniqueIds(items, ctx, 'style-mood'));

export const CompositionRuleLibrarySchema = z
  .array(CompositionRuleSchema)
  .superRefine((items, ctx) => ensureUniqueIds(items, ctx, 'composition-rule'));

export const TheoryKnowledgeBaseSchema = z.object({
  progressions: ProgressionLibrarySchema,
  harmonyTechniques: HarmonyTechniqueLibrarySchema,
  styleMoods: StyleMoodLibrarySchema,
  compositionRules: CompositionRuleLibrarySchema
});
export type TheoryKnowledgeBase = z.infer<typeof TheoryKnowledgeBaseSchema>;
