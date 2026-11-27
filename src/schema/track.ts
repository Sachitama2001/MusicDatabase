import { z } from 'zod';
import { isValidChordSymbol } from '../midi/chordEngine';

export const ChordTubeSourceSchema = z.object({
  platform: z.literal('chordtube'),
  url: z
    .string()
    .url()
    .refine((u) => u.startsWith('https://chordtube.net/'), {
      message: 'source.url must start with "https://chordtube.net/"'
    }),
  youtubeId: z.string().min(1).max(32).optional(),
  isSample: z.boolean().optional()
});
export type ChordTubeSource = z.infer<typeof ChordTubeSourceSchema>;

export const ChordEventSchema = z.object({
  symbol: z
    .string()
    .min(1)
    .max(32)
    .refine((s) => isValidChordSymbol(s), {
      message: 'Chord symbol could not be parsed by chordEngine'
    }),
  roman: z.string().min(1).max(32),
  beats: z.number().gt(0).lte(32),
  note: z.string().max(200).optional()
});
export type ChordEvent = z.infer<typeof ChordEventSchema>;

export const SectionLabelSchema = z.enum([
  'intro',
  'verse',
  'pre_chorus',
  'chorus',
  'bridge',
  'drop',
  'interlude',
  'outro',
  'other'
]);
export type SectionLabel = z.infer<typeof SectionLabelSchema>;

export const SectionSchema = z
  .object({
    id: z.string().min(1).max(120),
    label: SectionLabelSchema,
    displayName: z.string().min(1).max(120),
    order: z.number().int().min(1),
    startSec: z.number().min(0).optional(),
    endSec: z.number().min(0).optional(),
    localKey: z.string().min(1).max(60).optional(),
    localBpm: z.number().min(20).max(350).optional(),
    localTimeSignature: z.string().regex(/^\d+\/\d+$/).optional(),
    feelings: z.array(z.string().min(1)).min(1),
    feelingSummary: z.string().min(1),
    chords: z.array(ChordEventSchema).min(1),
    cadenceOrMotion: z.string().optional(),
    rating: z.number().int().min(1).max(5).optional(),
    tags: z.array(z.string().min(1)).optional()
  })
  .superRefine((section, ctx) => {
    if (
      section.startSec !== undefined &&
      section.endSec !== undefined &&
      section.startSec > section.endSec
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endSec'],
        message: 'endSec must be greater than or equal to startSec'
      });
    }
  });
export type Section = z.infer<typeof SectionSchema>;

export const TrackSchema = z
  .object({
    schemaVersion: z.literal('2.0'),
    id: z
      .string()
      .regex(
        /^[a-z0-9-]+--[a-z0-9-]+$/,
        'id must match "<artist-slug>--<track-slug>" using lowercase ASCII letters, digits, and hyphens'
      ),
    title: z.string().min(1).max(200),
    artist: z.string().min(1).max(200),
    source: ChordTubeSourceSchema,
    bpm: z.number().min(20).max(350),
    key: z.string().min(1).max(60),
    timeSignature: z.string().regex(/^\d+\/\d+$/).default('4/4'),
    releaseYear: z.number().int().min(1900).max(2100).optional(),
    genres: z.array(z.string().min(1)).optional(),
    overallFeelings: z.array(z.string().min(1)).optional(),
    notes: z.string().optional(),
    sections: z.array(SectionSchema).min(1),
    createdAt: z.string().datetime({ offset: true }),
    updatedAt: z.string().datetime({ offset: true })
  })
  .superRefine((track, ctx) => {
    const sectionIds = new Set<string>();
    for (let i = 0; i < track.sections.length; i++) {
      const sec = track.sections[i];
      if (sectionIds.has(sec.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['sections', i, 'id'],
          message: `Duplicate section id "${sec.id}" within track "${track.id}"`
        });
      }
      sectionIds.add(sec.id);
    }
  });
export type Track = z.infer<typeof TrackSchema>;
