import fs from 'node:fs';
import path from 'node:path';
import { Midi } from '@tonejs/midi';
import { describe, expect, it } from 'vitest';
import { TrackSchema } from '../schema';
import { midiClipToSmf, smfToMidiClip, transposeMidiClip } from './converter';

const polyphia = TrackSchema.parse(
  JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'data/tracks/polyphia--yas.json'), 'utf-8')
  )
);
const sampleClip = polyphia.sections[0].midiClips![0];

describe('MIDI converter and transpose invariants', () => {
  it('transposes piano and bass by +2 semitones while preserving drum note numbers', () => {
    const transposed = transposeMidiClip(sampleClip, 2);

    const origPiano = sampleClip.tracks.find((t) => t.role === 'piano')!;
    const nextPiano = transposed.tracks.find((t) => t.role === 'piano')!;
    expect(nextPiano.notes[0].midi).toBe(origPiano.notes[0].midi + 2);

    const origBass = sampleClip.tracks.find((t) => t.role === 'bass')!;
    const nextBass = transposed.tracks.find((t) => t.role === 'bass')!;
    expect(nextBass.notes[0].midi).toBe(origBass.notes[0].midi + 2);

    const origDrum = sampleClip.tracks.find((t) => t.role === 'drum')!;
    const nextDrum = transposed.tracks.find((t) => t.role === 'drum')!;
    expect(nextDrum.notes.map((n) => n.midi)).toEqual(origDrum.notes.map((n) => n.midi));
  });

  it('exports Standard MIDI File Format 1 with separate tracks and drum on channel 9 (Ch.10)', () => {
    const bytes = midiClipToSmf(sampleClip);

    // MThd header check + Format 1 (bytes 8..9 == 0x00, 0x01)
    expect(String.fromCharCode(bytes[0], bytes[1], bytes[2], bytes[3])).toBe('MThd');
    expect(bytes[8]).toBe(0);
    expect(bytes[9]).toBe(1);

    const parsed = new Midi(bytes);
    expect(parsed.tracks).toHaveLength(3);
    const drumTrack = parsed.tracks.find((t) => t.name === 'Drums');
    expect(drumTrack).toBeDefined();
    expect(drumTrack!.channel).toBe(9);
  });

  it('preserves BPM, track roles, pitches, and beat timing across SMF round-trip', () => {
    const bytes = midiClipToSmf(sampleClip);
    const restored = smfToMidiClip(bytes, 'roundtrip.mid');

    expect(restored.bpm).toBe(sampleClip.bpm);
    expect(restored.timeSignature).toBe(sampleClip.timeSignature);
    expect(restored.tracks.map((t) => t.role)).toEqual(['piano', 'bass', 'drum']);

    for (let i = 0; i < sampleClip.tracks.length; i++) {
      const origNotes = [...sampleClip.tracks[i].notes].sort(
        (a, b) => a.startBeat - b.startBeat || a.midi - b.midi
      );
      const nextNotes = restored.tracks[i].notes;
      expect(nextNotes).toHaveLength(origNotes.length);
      expect(nextNotes[0].midi).toBe(origNotes[0].midi);
      expect(nextNotes[0].startBeat).toBeCloseTo(origNotes[0].startBeat, 3);
      expect(nextNotes[0].durationBeats).toBeCloseTo(origNotes[0].durationBeats, 3);
    }
  });

  it('throws a clear error for non-MIDI binary input', () => {
    const invalidBytes = new Uint8Array([0x00, 0x01, 0x02, 0x03, 0x04]);
    expect(() => smfToMidiClip(invalidBytes)).toThrow(/Invalid MIDI file header/);
  });
});
