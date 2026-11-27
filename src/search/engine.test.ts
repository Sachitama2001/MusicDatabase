import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { FeelingLexiconSchema, TrackSchema } from '../schema';
import {
  ChordSearchEngine,
  matchesChordSubsequence,
  matchesRomanSubsequence
} from './engine';

const lexicon = FeelingLexiconSchema.parse(
  JSON.parse(fs.readFileSync(path.resolve(process.cwd(), 'data/feelings.json'), 'utf-8'))
);
const sample = TrackSchema.parse(
  JSON.parse(
    fs.readFileSync(
      path.resolve(process.cwd(), 'data/tracks/chordtube-sample--marusa-progression.json'),
      'utf-8'
    )
  )
);

describe('ChordSearchEngine (v2)', () => {
  const engine = new ChordSearchEngine([sample], lexicon);

  it('expands feeling synonyms such as "おしゃれ" -> "スタイリッシュ" and "泣ける" -> "切ない"', () => {
    const stylishHits = engine.search({ query: 'おしゃれ' });
    expect(stylishHits).toHaveLength(1);
    expect(stylishHits[0].record.section.id).toBe('sec-01-marusa');

    const sadHits = engine.search({ query: '泣ける' });
    expect(sadHits).toHaveLength(2);
  });

  it('matches contiguous Roman numeral subsequences with case-sensitive degree quality', () => {
    expect(matchesRomanSubsequence(['IVM7', 'III7', 'VIm7', 'Vm7', 'I7'], 'IVM7 III7 VIm7')).toBe(
      true
    );
    expect(matchesRomanSubsequence(['IVM7', 'III7', 'VIm7', 'Vm7', 'I7'], 'VIm7 III7')).toBe(false);
    expect(matchesRomanSubsequence(['IV', 'V', 'IIIm', 'VIm'], 'iv v')).toBe(false);

    const hits = engine.search({ query: '', romanQuery: 'IVM7 III7 VIm7' });
    expect(hits).toHaveLength(1);
    expect(hits[0].record.section.id).toBe('sec-01-marusa');
  });

  it('matches contiguous chord symbol subsequences', () => {
    expect(matchesChordSubsequence(['FM7', 'E7', 'Am7', 'Gm7', 'C7'], 'FM7 E7 Am7')).toBe(true);
    const hits = engine.search({ query: '', chordQuery: 'F G Em' });
    expect(hits).toHaveLength(1);
    expect(hits[0].record.section.id).toBe('sec-02-odo');
  });
});
