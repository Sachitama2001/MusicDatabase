import { Midi } from '@tonejs/midi';
import { MidiClipSchema, type MidiClip, type MidiRole, type MidiTrackData } from '../schema';

export const DEFAULT_ROLE_SETTINGS: Record<
  MidiRole,
  { channel: number; program: number; trackName: string }
> = {
  piano: { channel: 0, program: 0, trackName: 'Piano' },
  bass: { channel: 1, program: 33, trackName: 'Bass' },
  drum: { channel: 9, program: 0, trackName: 'Drums' }
};

export function parseTimeSignature(ts: string): [number, number] {
  const match = /^(\d+)\/(\d+)$/.exec(ts.trim());
  if (!match) return [4, 4];
  const num = Number(match[1]);
  const den = Number(match[2]);
  if (num <= 0 || den <= 0) return [4, 4];
  return [num, den];
}

export function getBeatsPerBar(timeSignature: string): number {
  const [num, den] = parseTimeSignature(timeSignature);
  return num * (4 / den);
}

export function getClipTotalBeats(clip: MidiClip): number {
  const fromBars = clip.bars * getBeatsPerBar(clip.timeSignature);
  let maxNoteEnd = 0;
  for (const track of clip.tracks) {
    for (const note of track.notes) {
      const end = note.startBeat + note.durationBeats;
      if (end > maxNoteEnd) maxNoteEnd = end;
    }
  }
  return Math.max(fromBars, maxNoteEnd);
}

function clampMidi(pitch: number): number {
  return Math.max(0, Math.min(127, Math.round(pitch)));
}

/**
 * Transposes piano and bass tracks by `semitones` while preserving drum note numbers.
 */
export function transposeMidiClip(clip: MidiClip, semitones: number): MidiClip {
  if (semitones === 0) return clip;
  return {
    ...clip,
    tracks: clip.tracks.map((track) => {
      if (track.role === 'drum') {
        return {
          ...track,
          notes: track.notes.map((n) => ({ ...n }))
        };
      }
      return {
        ...track,
        notes: track.notes.map((n) => ({
          ...n,
          midi: clampMidi(n.midi + semitones)
        }))
      };
    })
  };
}

export interface ExportSmfOptions {
  transpose?: number;
  bpmOverride?: number;
  mutedRoles?: ReadonlySet<MidiRole>;
}

/**
 * Converts a validated MidiClip into a Standard MIDI File (Format 1) byte array.
 */
export function midiClipToSmf(clip: MidiClip, options: ExportSmfOptions = {}): Uint8Array {
  const validated = MidiClipSchema.parse(clip);
  const transposed = transposeMidiClip(validated, options.transpose ?? 0);
  const bpm = options.bpmOverride ?? transposed.bpm;
  const [tsNum, tsDen] = parseTimeSignature(transposed.timeSignature);

  const midi = new Midi();
  const ppq = midi.header.ppq;
  midi.header.name = transposed.name;
  midi.header.setTempo(bpm);
  midi.header.timeSignatures.push({
    ticks: 0,
    timeSignature: [tsNum, tsDen],
    measures: 0
  });

  const activeTracks = transposed.tracks.filter(
    (track) => !options.mutedRoles?.has(track.role)
  );

  for (const srcTrack of activeTracks) {
    const defaults = DEFAULT_ROLE_SETTINGS[srcTrack.role];
    const smfTrack = midi.addTrack();
    smfTrack.name = defaults.trackName;
    smfTrack.channel = srcTrack.role === 'drum' ? 9 : (srcTrack.channel ?? defaults.channel);
    if (srcTrack.role !== 'drum') {
      smfTrack.instrument.number = srcTrack.program ?? defaults.program;
    }

    for (const note of srcTrack.notes) {
      const startTicks = Math.max(0, Math.round(note.startBeat * ppq));
      const durationTicks = Math.max(1, Math.round(note.durationBeats * ppq));
      smfTrack.addNote({
        midi: clampMidi(note.midi),
        ticks: startTicks,
        durationTicks,
        velocity: Math.max(0.01, Math.min(1, note.velocity))
      });
    }
  }

  return midi.toArray();
}

function roundBeat(value: number): number {
  return Math.round(value * 10000) / 10000;
}

function inferTrackRole(track: Midi['tracks'][number]): MidiRole {
  const lowerName = (track.name || '').toLowerCase();
  if (
    track.channel === 9 ||
    track.instrument.percussion ||
    lowerName.includes('drum') ||
    lowerName.includes('perc') ||
    lowerName.includes('kit')
  ) {
    return 'drum';
  }
  if (
    lowerName.includes('bass') ||
    (track.instrument.number >= 32 && track.instrument.number <= 39)
  ) {
    return 'bass';
  }
  if (lowerName.includes('piano') || lowerName.includes('key') || lowerName.includes('chord')) {
    return 'piano';
  }
  if (track.notes.length > 0) {
    const avgMidi = track.notes.reduce((sum, n) => sum + n.midi, 0) / track.notes.length;
    if (avgMidi < 50) return 'bass';
  }
  return 'piano';
}

function slugifyId(name: string): string {
  const base = name
    .toLowerCase()
    .replace(/\.mid(i)?$/i, '')
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '');
  return base ? `imported-${base}` : 'imported-midi-clip';
}

/**
 * Parses a Standard MIDI File binary into a MidiClip object suitable for LLM editing and playback.
 */
export function smfToMidiClip(
  data: ArrayBuffer | Uint8Array,
  fallbackName = 'Imported MIDI'
): MidiClip {
  const bytes = data instanceof Uint8Array ? data : new Uint8Array(data);
  if (
    bytes.length < 14 ||
    bytes[0] !== 0x4d ||
    bytes[1] !== 0x54 ||
    bytes[2] !== 0x68 ||
    bytes[3] !== 0x64
  ) {
    throw new Error(
      'Invalid MIDI file header. Please provide a Standard MIDI File (.mid).'
    );
  }

  let midi: Midi;
  try {
    midi = new Midi(bytes);
  } catch (err) {
    throw new Error(
      `Failed to parse Standard MIDI File: ${err instanceof Error ? err.message : String(err)}`
    );
  }

  const ppq = midi.header.ppq || 480;
  const rawBpm = midi.header.tempos[0]?.bpm ?? 120;
  const bpm = Math.max(20, Math.min(350, Math.round(rawBpm * 100) / 100));
  const ts = midi.header.timeSignatures[0]?.timeSignature ?? [4, 4];
  const timeSignature = `${ts[0]}/${ts[1]}`;
  const beatsPerBar = getBeatsPerBar(timeSignature);

  const nonEmptyTracks = midi.tracks.filter((t) => t.notes.length > 0);
  if (nonEmptyTracks.length === 0) {
    throw new Error('The MIDI file contains no note events.');
  }

  const tracks: MidiTrackData[] = [];
  let maxEndBeat = 0;

  for (const srcTrack of nonEmptyTracks) {
    const role = inferTrackRole(srcTrack);
    const defaults = DEFAULT_ROLE_SETTINGS[role];
    const notes = srcTrack.notes
      .map((n) => {
        const startBeat = Math.max(0, roundBeat(n.ticks / ppq));
        const durationBeats = Math.max(0.0625, roundBeat(n.durationTicks / ppq));
        const endBeat = startBeat + durationBeats;
        if (endBeat > maxEndBeat) maxEndBeat = endBeat;
        return {
          midi: clampMidi(n.midi),
          startBeat,
          durationBeats,
          velocity: Math.max(0.05, Math.min(1, Math.round(n.velocity * 1000) / 1000))
        };
      })
      .sort((a, b) => a.startBeat - b.startBeat || a.midi - b.midi);

    tracks.push({
      role,
      channel: role === 'drum' ? 9 : defaults.channel,
      ...(role !== 'drum' ? { program: srcTrack.instrument.number ?? defaults.program } : {}),
      notes
    });
  }

  const bars = Math.max(1, Math.min(64, Math.ceil(maxEndBeat / beatsPerBar)));
  const cleanName = (midi.header.name || fallbackName).replace(/\.mid(i)?$/i, '').trim() || 'Imported MIDI';

  return MidiClipSchema.parse({
    id: slugifyId(cleanName),
    name: cleanName,
    bpm,
    timeSignature,
    bars,
    tracks
  });
}

export function triggerSmfDownload(clip: MidiClip, options: ExportSmfOptions = {}): void {
  const bytes = midiClipToSmf(clip, options);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy.buffer], { type: 'audio/midi' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeName = clip.name
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '');
  link.href = url;
  link.download = `${safeName || clip.id}.mid`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
