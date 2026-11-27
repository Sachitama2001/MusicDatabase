import { z } from 'zod';
import { FeelingLexiconSchema } from './feelings';
import { MidiClipSchema, TrackSchema } from './track';

export * from './track';
export * from './feelings';

export const DatabaseIndexSchema = z.object({
  schemaVersion: z.literal('1.0'),
  generatedAt: z.string().datetime({ offset: true }),
  trackCount: z.number().int().min(0),
  sectionCount: z.number().int().min(0),
  feelings: FeelingLexiconSchema,
  tracks: z.array(TrackSchema)
});
export type DatabaseIndex = z.infer<typeof DatabaseIndexSchema>;

export interface ValidationIssue {
  path: string;
  message: string;
}

export interface ValidationResult<T> {
  success: boolean;
  data?: T;
  issues: ValidationIssue[];
}

export function formatZodIssues(error: z.ZodError): ValidationIssue[] {
  return error.issues.map((issue) => ({
    path: issue.path.length > 0 ? issue.path.join('.') : '(root)',
    message: issue.message
  }));
}

export function validateTrackData(input: unknown): ValidationResult<z.infer<typeof TrackSchema>> {
  const result = TrackSchema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data, issues: [] };
  }
  return { success: false, issues: formatZodIssues(result.error) };
}

export function validateMidiClipData(
  input: unknown
): ValidationResult<z.infer<typeof MidiClipSchema>> {
  const result = MidiClipSchema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data, issues: [] };
  }
  return { success: false, issues: formatZodIssues(result.error) };
}

export function validateFeelingLexiconData(
  input: unknown
): ValidationResult<z.infer<typeof FeelingLexiconSchema>> {
  const result = FeelingLexiconSchema.safeParse(input);
  if (result.success) {
    return { success: true, data: result.data, issues: [] };
  }
  return { success: false, issues: formatZodIssues(result.error) };
}
