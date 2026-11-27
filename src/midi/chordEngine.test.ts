import { Midi } from '@tonejs/midi';
import { describe, expect, it } from 'vitest';
import {
  generatePianoSequence,
  parseChordSymbol,
  parseQuickChordLine,
  resolveRomanToChord,
  transposeChordSymbol
} from './chordEngine';
import { chordProgressionToSmf } from './smfExport';

describe('chordEngine and Piano SMF export', () => {
  it('parses chord symbols into exact pitch-class intervals including slash bass and N.C.', () => {
    const fm7 = parseChordSymbol('FM7')!;
    expect(fm7.rootPc).toBe(5); // F
    expect(fm7.intervals).toEqual([0, 4, 7, 11]); // F, A, C, E

    const e7 = parseChordSymbol('E7')!;
    expect(e7.rootPc).toBe(4); // E
    expect(e7.intervals).toEqual([0, 4, 7, 10]); // E, G#, B, D

    const dOverFSharp = parseChordSymbol('D/F#')!;
    expect(dOverFSharp.rootPc).toBe(2); // D
    expect(dOverFSharp.bassPc).toBe(6); // F#

    const rest = parseChordSymbol('N.C.')!;
    expect(rest.isRest).toBe(true);
  });

  it('resolves ChordTube Roman numerals into concrete chord symbols', () => {
    expect(resolveRomanToChord('IVM7', 'C major')).toBe('FM7');
    expect(resolveRomanToChord('V/VII', 'C major')).toBe('G/B');
    expect(resolveRomanToChord('IIIm', 'G major')).toBe('Bm');
    expect(resolveRomanToChord('bVImaj9', 'F# minor')).toBe('Dmaj9');
  });

  it('transposes chord symbols including slash bass notes', () => {
    expect(transposeChordSymbol('FM7', 2)).toBe('GM7');
    expect(transposeChordSymbol('D/F#', 2)).toBe('E/G#');
    expect(transposeChordSymbol('N.C.', 5)).toBe('N.C.');
  });

  it('generates a single-track Piano SMF matching chord beats and transpose', () => {
    const chords = parseQuickChordLine('FM7(2) E7(2) Am7(2) Gm7(1) C7(1)');
    expect(chords).toHaveLength(5);

    const baseSeq = generatePianoSequence(chords, { voicing: 'root', transpose: 0 });
    const transposedSeq = generatePianoSequence(chords, { voicing: 'root', transpose: 2 });

    expect(baseSeq.totalBeats).toBe(8);
    expect(transposedSeq.chordSpans[0].displaySymbol).toBe('GM7');
    expect(transposedSeq.chordSpans[1].displaySymbol).toBe('F#7');

    // Verify exact pitch class shift (+2 mod 12) across all generated notes
    expect(transposedSeq.notes.map((n) => n.midi % 12)).toEqual(
      baseSeq.notes.map((n) => (n.midi + 2) % 12)
    );

    const smfBytes = chordProgressionToSmf(chords, {
      name: 'Marusa',
      bpm: 120,
      timeSignature: '4/4',
      voicing: 'smooth'
    });
    const parsed = new Midi(smfBytes);
    expect(parsed.tracks).toHaveLength(1);
    expect(parsed.tracks[0].name).toBe('Piano');
    expect(parsed.tracks[0].channel).toBe(0);
    expect(parsed.tracks[0].instrument.number).toBe(0);
    expect(parsed.tracks[0].notes.length).toBeGreaterThan(0);
  });

  it('parses combined ChordTube dominant extensions', () => {
    expect(parseChordSymbol('Eb7(9,#11)')?.intervals).toEqual([0, 4, 7, 10, 14, 18]);
    expect(parseChordSymbol('Eb7(9,13)')?.intervals).toEqual([0, 4, 7, 10, 14, 21]);
  });

  it('defaults to arpeggio voicing', () => {
    const chords = parseQuickChordLine('Cmaj7(4) Fmaj7(4)');
    const defaultSequence = generatePianoSequence(chords);
    const arpeggioSequence = generatePianoSequence(chords, { voicing: 'arpeggio' });
    expect(defaultSequence.notes).toEqual(arpeggioSequence.notes);
  });

  it('uses bar and beat offsets and ties an anticipation into the next bar', () => {
    const chords = [
      { symbol: 'Cmaj7', beats: 0.5, bar: 1, beatOffset: 3.5 },
      { symbol: 'Cmaj7', beats: 4, bar: 2, beatOffset: 0 }
    ];
    const sequence = generatePianoSequence(chords);
    expect(sequence.chordSpans[0].startBeat).toBe(3.5);
    expect(sequence.chordSpans[1].startBeat).toBe(4);
    expect(sequence.totalBeats).toBe(8);

    const tied = sequence.notes.find((note) => note.startBeat === 3.5);
    expect(tied).toBeDefined();
    expect(tied!.durationBeats).toBeGreaterThan(0.5);
  });

  it('accounts for a 2/4 bar when calculating later bar positions', () => {
    const chords = [
      { symbol: 'Cmaj7', beats: 4, bar: 1, beatOffset: 0 },
      { symbol: 'Fmaj7', beats: 2, bar: 2, beatOffset: 0, barBeats: 2 },
      { symbol: 'G7', beats: 4, bar: 3, beatOffset: 0 }
    ];
    const sequence = generatePianoSequence(chords);
    expect(sequence.chordSpans.map((span) => span.startBeat)).toEqual([0, 4, 6]);
    expect(sequence.totalBeats).toBe(10);
  });

  it('parses Roman numeral quick lines when a key is provided', () => {
    const chords = parseQuickChordLine('IVM7(2) III7(2) VIm7(4)', 'C major');
    expect(chords.map((c) => c.symbol)).toEqual(['FM7', 'E7', 'Am7']);
    expect(chords.map((c) => c.beats)).toEqual([2, 2, 4]);
  });

  it('parses extended MusicTheory chord notations including parenthesized tensions and omit3', () => {
    expect(parseChordSymbol('Am7(9)')?.intervals).toEqual([0, 3, 7, 10, 14]);
    expect(parseChordSymbol('G7sus(9)')?.intervals).toEqual([0, 5, 7, 10, 14]);
    expect(parseChordSymbol('Am7(11)omit3')?.intervals).toEqual([0, 7, 10, 17]);
    expect(parseChordSymbol('Dm(b5)')?.intervals).toEqual([0, 3, 6]);
    const gaugOverB = parseChordSymbol('Gaug/B')!;
    expect(gaugOverB.rootPc).toBe(7);
    expect(gaugOverB.bassPc).toBe(11);
    expect(gaugOverB.intervals).toEqual([0, 4, 8]);
  });
});
