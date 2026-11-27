import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { validateMidiClipData, validateTrackData } from './index';

const SAMPLE_TRACK_PATH = path.resolve(process.cwd(), 'data/tracks/polyphia--yas.json');
const sampleTrack = JSON.parse(fs.readFileSync(SAMPLE_TRACK_PATH, 'utf-8'));

describe('TrackSchema and invariants', () => {
  it('accepts the repository sample track polyphia--yas.json', () => {
    const result = validateTrackData(sampleTrack);
    expect(result.success).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('rejects a section where rhythm, melody, and harmony are all empty', () => {
    const broken = structuredClone(sampleTrack);
    delete broken.sections[0].rhythm;
    delete broken.sections[0].melody;
    delete broken.sections[0].harmony;

    const result = validateTrackData(broken);
    expect(result.success).toBe(false);
    expect(result.issues.some((i) => i.message.includes('At least one of rhythm'))).toBe(true);
  });

  it('rejects invalid bar/sec ranges and duplicate section IDs', () => {
    const broken = structuredClone(sampleTrack);
    broken.sections[0].startBar = 16;
    broken.sections[0].endBar = 8;
    broken.sections.push(structuredClone(broken.sections[0]));

    const result = validateTrackData(broken);
    expect(result.success).toBe(false);
    expect(result.issues.some((i) => i.path.includes('endBar'))).toBe(true);
    expect(result.issues.some((i) => i.message.includes('Duplicate section id'))).toBe(true);
  });

  it('rejects Track.id not matching "<artist-slug>--<track-slug>"', () => {
    const broken = structuredClone(sampleTrack);
    broken.id = 'Polyphia_Yas';
    const result = validateTrackData(broken);
    expect(result.success).toBe(false);
  });

  it('rejects MidiClip with out-of-range pitch, unsupported role, or zero velocity', () => {
    const badClip = {
      id: 'bad-clip',
      name: 'Bad',
      bpm: 120,
      timeSignature: '4/4',
      bars: 2,
      tracks: [
        {
          role: 'guitar',
          notes: [{ midi: 128, startBeat: 0, durationBeats: 1, velocity: 0 }]
        }
      ]
    };
    const result = validateMidiClipData(badClip);
    expect(result.success).toBe(false);
    expect(result.issues.length).toBeGreaterThanOrEqual(3);
  });
});
