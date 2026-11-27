import { z } from 'zod';

export const MidiRoleSchema = z.enum(['piano', 'bass', 'drum']);
export type MidiRole = z.infer<typeof MidiRoleSchema>;

export const MidiNoteSchema = z.object({
  midi: z.number().int().min(0).max(127),
  startBeat: z.number().min(0),
  durationBeats: z.number().positive(),
  velocity: z.number().gt(0).lte(1)
});
export type MidiNote = z.infer<typeof MidiNoteSchema>;

export const MidiTrackDataSchema = z.object({
  role: MidiRoleSchema,
  program: z.number().int().min(0).max(127).optional(),
  channel: z.number().int().min(0).max(15).optional(),
  notes: z.array(MidiNoteSchema)
});
export type MidiTrackData = z.infer<typeof MidiTrackDataSchema>;

export const MidiClipSchema = z.object({
  id: z.string().min(1).max(120),
  name: z.string().min(1).max(200),
  bpm: z.number().min(20).max(350),
  key: z.string().min(1).max(60).optional(),
  timeSignature: z.string().regex(/^\d+\/\d+$/).default('4/4'),
  bars: z.number().int().min(1).max(64),
  tracks: z.array(MidiTrackDataSchema).min(1)
});
export type MidiClip = z.infer<typeof MidiClipSchema>;

export const RhythmFeelSchema = z.enum([
  'straight',
  'half-time',
  'double-time',
  'shuffle',
  'swing',
  'syncopated',
  'polyrhythm',
  'other'
]);
export type RhythmFeel = z.infer<typeof RhythmFeelSchema>;

export const RhythmElementSchema = z.object({
  feel: RhythmFeelSchema.optional(),
  grooveDescription: z.string().min(1).optional(),
  drumNotes: z.string().min(1).optional(),
  bassNotes: z.string().min(1).optional(),
  tags: z.array(z.string().min(1)).optional()
});
export type RhythmElement = z.infer<typeof RhythmElementSchema>;

export const MelodyElementSchema = z.object({
  scaleOrMode: z.string().min(1).optional(),
  contour: z.string().min(1).optional(),
  hookDescription: z.string().min(1).optional(),
  register: z.string().min(1).optional(),
  tags: z.array(z.string().min(1)).optional()
});
export type MelodyElement = z.infer<typeof MelodyElementSchema>;

export const HarmonyElementSchema = z.object({
  chordProgression: z.array(z.string().min(1)).optional(),
  romanNumerals: z.array(z.string().min(1)).optional(),
  cadenceOrMotion: z.string().min(1).optional(),
  voicingNotes: z.string().min(1).optional(),
  modulationNotes: z.string().min(1).optional(),
  tags: z.array(z.string().min(1)).optional()
});
export type HarmonyElement = z.infer<typeof HarmonyElementSchema>;

export const SectionLabelSchema = z.enum([
  'intro',
  'verse',
  'pre_chorus',
  'chorus',
  'bridge',
  'drop',
  'solo',
  'interlude',
  'outro',
  'other'
]);
export type SectionLabel = z.infer<typeof SectionLabelSchema>;

function hasNonEmptyFields(obj: Record<string, unknown> | undefined): boolean {
  if (!obj) return false;
  return Object.values(obj).some((val) => {
    if (typeof val === 'string') return val.trim().length > 0;
    if (Array.isArray(val)) return val.length > 0;
    return val !== undefined && val !== null;
  });
}

export const SectionSchema = z
  .object({
    id: z.string().min(1).max(120),
    label: SectionLabelSchema,
    displayName: z.string().min(1).max(120),
    order: z.number().int().min(1),
    startBar: z.number().int().min(1).optional(),
    endBar: z.number().int().min(1).optional(),
    startSec: z.number().min(0).optional(),
    endSec: z.number().min(0).optional(),
    localBpm: z.number().min(20).max(350).optional(),
    localKey: z.string().min(1).max(60).optional(),
    localTimeSignature: z.string().regex(/^\d+\/\d+$/).optional(),
    feelings: z.array(z.string().min(1)).min(1),
    feelingSummary: z.string().min(1),
    rhythm: RhythmElementSchema.optional(),
    melody: MelodyElementSchema.optional(),
    harmony: HarmonyElementSchema.optional(),
    instruments: z.array(z.string().min(1)).optional(),
    rating: z.number().int().min(1).max(5).optional(),
    tags: z.array(z.string().min(1)).optional(),
    midiClips: z.array(MidiClipSchema).optional()
  })
  .superRefine((section, ctx) => {
    if (
      section.startBar !== undefined &&
      section.endBar !== undefined &&
      section.startBar > section.endBar
    ) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['endBar'],
        message: 'endBar must be greater than or equal to startBar'
      });
    }

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

    const hasAnyMusicalElement =
      hasNonEmptyFields(section.rhythm as Record<string, unknown> | undefined) ||
      hasNonEmptyFields(section.melody as Record<string, unknown> | undefined) ||
      hasNonEmptyFields(section.harmony as Record<string, unknown> | undefined);

    if (!hasAnyMusicalElement) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['rhythm'],
        message: 'At least one of rhythm, melody, or harmony must contain analysis data'
      });
    }

    if (section.midiClips) {
      const clipIds = new Set<string>();
      for (let i = 0; i < section.midiClips.length; i++) {
        const clip = section.midiClips[i];
        if (clipIds.has(clip.id)) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['midiClips', i, 'id'],
            message: `Duplicate MidiClip id "${clip.id}" within section "${section.id}"`
          });
        }
        clipIds.add(clip.id);
      }
    }
  });
export type Section = z.infer<typeof SectionSchema>;

export const ReferenceLinkSchema = z.object({
  kind: z.enum(['youtube', 'spotify', 'chords', 'score', 'other']),
  url: z.string().url(),
  label: z.string().min(1).max(160)
});
export type ReferenceLink = z.infer<typeof ReferenceLinkSchema>;

export const VersionTypeSchema = z.enum([
  'original',
  'arrangement',
  'cover',
  'remix',
  'live',
  'other'
]);
export type VersionType = z.infer<typeof VersionTypeSchema>;

export const TrackSchema = z
  .object({
    schemaVersion: z.literal('1.0'),
    id: z
      .string()
      .regex(
        /^[a-z0-9-]+--[a-z0-9-]+$/,
        'id must match "<artist-slug>--<track-slug>" using lowercase ASCII letters, digits, and hyphens'
      ),
    title: z.string().min(1).max(200),
    artist: z.string().min(1).max(200),
    workId: z.string().min(1).max(200).optional(),
    versionType: VersionTypeSchema.default('original'),
    composers: z.array(z.string().min(1)).optional(),
    arrangers: z.array(z.string().min(1)).optional(),
    releaseYear: z.number().int().min(1900).max(2100).optional(),
    bpm: z.number().min(20).max(350).optional(),
    key: z.string().min(1).max(60).optional(),
    timeSignature: z.string().regex(/^\d+\/\d+$/).optional(),
    durationSec: z.number().positive().optional(),
    genres: z.array(z.string().min(1)).optional(),
    overallFeelings: z.array(z.string().min(1)).optional(),
    references: z.array(ReferenceLinkSchema).optional(),
    localAudioHint: z.string().max(300).optional(),
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
