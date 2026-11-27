import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { isValidChordSymbol } from '../midi/chordEngine';
import {
  CompositionRuleLibrarySchema,
  HarmonyTechniqueLibrarySchema,
  ProgressionLibrarySchema,
  StyleMoodLibrarySchema,
  validateTrackData
} from './index';

const SAMPLE_PATH = path.resolve(
  process.cwd(),
  'data/tracks/chordtube-sample--marusa-progression.json'
);
const sampleTrack = JSON.parse(fs.readFileSync(SAMPLE_PATH, 'utf-8'));

describe('v2 ChordTube TrackSchema and invariants', () => {
  it('accepts the repository ChordTube sample file', () => {
    const result = validateTrackData(sampleTrack);
    expect(result.success).toBe(true);
    expect(result.issues).toHaveLength(0);
  });

  it('rejects non-chordtube.net URLs', () => {
    const broken = structuredClone(sampleTrack);
    broken.source.url = 'https://example.com/songs/123';
    const result = validateTrackData(broken);
    expect(result.success).toBe(false);
    expect(result.issues.some((i) => i.message.includes('https://chordtube.net/'))).toBe(true);
  });

  it('rejects unparseable chord symbols and non-positive beat durations', () => {
    const broken = structuredClone(sampleTrack);
    broken.sections[0].chords[0].symbol = 'H#maj99';
    broken.sections[0].chords[1].beats = 0;

    const result = validateTrackData(broken);
    expect(result.success).toBe(false);
    expect(result.issues.some((i) => i.path.includes('symbol'))).toBe(true);
    expect(result.issues.some((i) => i.path.includes('beats'))).toBe(true);
  });

  it('rejects duplicate section IDs and invalid startSec > endSec', () => {
    const broken = structuredClone(sampleTrack);
    broken.sections[0].startSec = 45;
    broken.sections[0].endSec = 10;
    broken.sections[1].id = broken.sections[0].id;

    const result = validateTrackData(broken);
    expect(result.success).toBe(false);
    expect(result.issues.some((i) => i.path.includes('endSec'))).toBe(true);
    expect(result.issues.some((i) => i.message.includes('Duplicate section id'))).toBe(true);
  });

  it('validates all integrated MusicTheory knowledge files and confirms every progression example is playable', () => {
    const theoryDir = path.resolve(process.cwd(), 'data/theory');
    const progressions = ProgressionLibrarySchema.parse(
      JSON.parse(fs.readFileSync(path.join(theoryDir, 'progressions.json'), 'utf-8'))
    );
    const techniques = HarmonyTechniqueLibrarySchema.parse(
      JSON.parse(fs.readFileSync(path.join(theoryDir, 'harmony-techniques.json'), 'utf-8'))
    );
    const styles = StyleMoodLibrarySchema.parse(
      JSON.parse(fs.readFileSync(path.join(theoryDir, 'style-moods.json'), 'utf-8'))
    );
    const rules = CompositionRuleLibrarySchema.parse(
      JSON.parse(fs.readFileSync(path.join(theoryDir, 'composition-rules.json'), 'utf-8'))
    );

    expect(progressions.length).toBeGreaterThanOrEqual(37);
    expect(techniques.length).toBeGreaterThanOrEqual(22);
    expect(styles.length).toBeGreaterThanOrEqual(12);
    expect(rules.length).toBeGreaterThanOrEqual(7);

    for (const p of progressions) {
      for (const sym of p.example) {
        expect(isValidChordSymbol(sym), `Unparseable symbol "${sym}" in ${p.id}`).toBe(true);
      }
    }
  });
});
