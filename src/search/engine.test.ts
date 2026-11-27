import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FeelingLexiconSchema, TrackSchema } from '../schema';
import { matchesRomanSubsequence, MusicSearchEngine } from './engine';

const lexicon = FeelingLexiconSchema.parse(
  JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'data/feelings.json'), 'utf-8'))
);
const polyphia = TrackSchema.parse(
  JSON.parse(
    fs.readFileSync(path.resolve(process.cwd(), 'data/tracks/polyphia--yas.json'), 'utf-8')
  )
);

describe('MusicSearchEngine', () => {
  const engine = new MusicSearchEngine([polyphia], lexicon);

  it('expands feeling synonyms so "エモい" or "メランコリック" matches "切ない"', () => {
    const hits = engine.search({ query: 'メランコリック' });
    expect(hits).toHaveLength(1);
    expect(hits[0].record.track.id).toBe('polyphia--yas');
  });

  it('matches multi-term Japanese feeling and groove queries', () => {
    const hits = engine.search({ query: '切ない ハーフテンポ' });
    expect(hits).toHaveLength(1);
    expect(hits[0].record.section.label).toBe('drop');
  });

  it('filters by contiguous Roman numeral subsequence', () => {
    expect(matchesRomanSubsequence(['V7alt', 'bVImaj9', 'v7', 'iv9'], 'bVImaj9 v7')).toBe(true);
    expect(matchesRomanSubsequence(['V7alt', 'bVImaj9', 'v7', 'iv9'], 'bVImaj9 -> v7')).toBe(true);
    expect(matchesRomanSubsequence(['V7alt', 'bVImaj9', 'v7', 'iv9'], 'v7 bVImaj9')).toBe(false);

    const hits = engine.search({ query: '', romanQuery: 'bVImaj9 v7' });
    expect(hits).toHaveLength(1);
  });

  it('respects BPM range and returns empty when outside bounds', () => {
    expect(engine.search({ query: '', bpmMin: 140, bpmMax: 150 })).toHaveLength(1);
    expect(engine.search({ query: '', bpmMin: 80, bpmMax: 100 })).toHaveLength(0);
  });
});
