export type VoicingStyle = 'smooth' | 'root' | 'open' | 'arpeggio';

export interface ChordInput {
  symbol: string;
  roman?: string;
  beats: number;
  bar?: number;
  beatOffset?: number;
  note?: string;
}

export interface ParsedChord {
  isRest: boolean;
  raw: string;
  rootPc?: number;
  bassPc?: number;
  quality?: string;
  intervals: number[];
}

export interface PianoNote {
  midi: number;
  startBeat: number;
  durationBeats: number;
  velocity: number;
  chordIndex: number;
}

export interface ChordSpan {
  index: number;
  originalSymbol: string;
  displaySymbol: string;
  roman?: string;
  startBeat: number;
  endBeat: number;
  beats: number;
  isRest: boolean;
}

export interface GeneratedPianoSequence {
  notes: PianoNote[];
  chordSpans: ChordSpan[];
  totalBeats: number;
}

const NOTE_TO_PC: Record<string, number> = {
  C: 0,
  'C#': 1,
  Db: 1,
  D: 2,
  'D#': 3,
  Eb: 3,
  E: 4,
  Fb: 4,
  'E#': 5,
  F: 5,
  'F#': 6,
  Gb: 6,
  G: 7,
  'G#': 8,
  Ab: 8,
  A: 9,
  'A#': 10,
  Bb: 10,
  B: 11,
  Cb: 11,
  'B#': 0
};

const SHARP_NAMES = ['C', 'C#', 'D', 'D#', 'E', 'F', 'F#', 'G', 'G#', 'A', 'A#', 'B'];
const FLAT_NAMES = ['C', 'Db', 'D', 'Eb', 'E', 'F', 'Gb', 'G', 'Ab', 'A', 'Bb', 'B'];

const QUALITY_INTERVALS: Record<string, number[]> = {
  '': [0, 4, 7],
  maj: [0, 4, 7],
  M: [0, 4, 7],
  m: [0, 3, 7],
  min: [0, 3, 7],
  '-': [0, 3, 7],
  '5': [0, 7],
  sus2: [0, 2, 7],
  sus4: [0, 5, 7],
  sus: [0, 5, 7],
  dim: [0, 3, 6],
  mb5: [0, 3, 6],
  minb5: [0, 3, 6],
  aug: [0, 4, 8],
  '+': [0, 4, 8],
  '6': [0, 4, 7, 9],
  m6: [0, 3, 7, 9],
  min6: [0, 3, 7, 9],
  '6/9': [0, 4, 7, 9, 14],
  '69': [0, 4, 7, 9, 14],
  add9: [0, 4, 7, 14],
  add2: [0, 4, 7, 14],
  madd9: [0, 3, 7, 14],
  minadd9: [0, 3, 7, 14],
  '7': [0, 4, 7, 10],
  M7: [0, 4, 7, 11],
  maj7: [0, 4, 7, 11],
  Maj7: [0, 4, 7, 11],
  m7: [0, 3, 7, 10],
  min7: [0, 3, 7, 10],
  '-7': [0, 3, 7, 10],
  mM7: [0, 3, 7, 11],
  mMaj7: [0, 3, 7, 11],
  minmaj7: [0, 3, 7, 11],
  dim7: [0, 3, 6, 9],
  m7b5: [0, 3, 6, 10],
  'm7-5': [0, 3, 6, 10],
  min7b5: [0, 3, 6, 10],
  '-7b5': [0, 3, 6, 10],
  '7sus4': [0, 5, 7, 10],
  '7sus': [0, 5, 7, 10],
  aug7: [0, 4, 8, 10],
  '+7': [0, 4, 8, 10],
  '7#5': [0, 4, 8, 10],
  '7+5': [0, 4, 8, 10],
  '7b5': [0, 4, 6, 10],
  '7-5': [0, 4, 6, 10],
  'maj7#5': [0, 4, 8, 11],
  'M7#5': [0, 4, 8, 11],
  'maj7#11': [0, 4, 7, 11, 18],
  'M7#11': [0, 4, 7, 11, 18],
  '9': [0, 4, 7, 10, 14],
  '79': [0, 4, 7, 10, 14],
  M9: [0, 4, 7, 11, 14],
  M79: [0, 4, 7, 11, 14],
  maj9: [0, 4, 7, 11, 14],
  maj79: [0, 4, 7, 11, 14],
  Maj9: [0, 4, 7, 11, 14],
  m9: [0, 3, 7, 10, 14],
  m79: [0, 3, 7, 10, 14],
  min9: [0, 3, 7, 10, 14],
  '-9': [0, 3, 7, 10, 14],
  mM9: [0, 3, 7, 11, 14],
  mMaj9: [0, 3, 7, 11, 14],
  '9sus4': [0, 5, 7, 10, 14],
  '9sus': [0, 5, 7, 10, 14],
  '7sus9': [0, 5, 7, 10, 14],
  '7sus49': [0, 5, 7, 10, 14],
  '11': [0, 4, 7, 10, 14, 17],
  '711': [0, 4, 7, 10, 14, 17],
  m11: [0, 3, 7, 10, 14, 17],
  m711: [0, 3, 7, 10, 14, 17],
  m711omit3: [0, 7, 10, 17],
  m11omit3: [0, 7, 10, 17],
  min11: [0, 3, 7, 10, 14, 17],
  maj11: [0, 4, 7, 11, 14, 17],
  M11: [0, 4, 7, 11, 14, 17],
  M711: [0, 4, 7, 11, 14, 17],
  '13': [0, 4, 7, 10, 14, 21],
  maj13: [0, 4, 7, 11, 14, 21],
  M13: [0, 4, 7, 11, 14, 21],
  m13: [0, 3, 7, 10, 14, 21],
  min13: [0, 3, 7, 10, 14, 21],
  '7b9': [0, 4, 7, 10, 13],
  '7-9': [0, 4, 7, 10, 13],
  '7#9': [0, 4, 7, 10, 15],
  '7+9': [0, 4, 7, 10, 15],
  '7#11': [0, 4, 7, 10, 18],
  '7b13': [0, 4, 7, 10, 20],
  '7-13': [0, 4, 7, 10, 20],
  '7alt': [0, 4, 10, 13, 20],
  alt: [0, 4, 10, 13, 20]
};

function normalizeChordText(raw: string): string {
  return raw
    .trim()
    .replace(/♯/g, '#')
    .replace(/♭/g, 'b')
    .replace(/[△Δ]/g, 'maj')
    .replace(/ø7?/g, 'm7b5')
    .replace(/°7/g, 'dim7')
    .replace(/°/g, 'dim')
    .replace(/[−–]/g, '-')
    .replace(/\s+/g, '');
}

function normalizeQuality(rawQuality: string): string {
  return rawQuality.replace(/[()]/g, '');
}

export function parseChordSymbol(symbol: string): ParsedChord | null {
  const cleaned = normalizeChordText(symbol);
  if (!cleaned) return null;

  if (/^(N\.?C\.?|-|REST)$/i.test(cleaned)) {
    return { isRest: true, raw: symbol.trim(), intervals: [] };
  }

  const match = /^([A-G](?:#|b)?)([^/]*?)(?:\/([A-G](?:#|b)?))?$/.exec(cleaned);
  if (!match) return null;

  const rootName = match[1];
  const rawQuality = match[2] ?? '';
  const bassName = match[3];

  const rootPc = NOTE_TO_PC[rootName];
  if (rootPc === undefined) return null;

  const normalizedQ = normalizeQuality(rawQuality);
  const intervals = QUALITY_INTERVALS[normalizedQ];
  if (!intervals) return null;

  const bassPc = bassName ? NOTE_TO_PC[bassName] : rootPc;
  if (bassPc === undefined) return null;

  return {
    isRest: false,
    raw: symbol.trim(),
    rootPc,
    bassPc,
    quality: rawQuality,
    intervals
  };
}

export function isValidChordSymbol(symbol: string): boolean {
  return parseChordSymbol(symbol) !== null;
}

function pcToNoteName(pc: number, preferFlat: boolean): string {
  const mod = ((pc % 12) + 12) % 12;
  return preferFlat ? FLAT_NAMES[mod] : SHARP_NAMES[mod];
}

export function transposeChordSymbol(
  symbol: string,
  semitones: number,
  preferFlat = false
): string {
  if (semitones === 0) return symbol;
  const parsed = parseChordSymbol(symbol);
  if (!parsed || parsed.isRest || parsed.rootPc === undefined) return symbol;

  const cleaned = normalizeChordText(symbol);
  const match = /^([A-G](?:#|b)?)([^/]*?)(?:\/([A-G](?:#|b)?))?$/.exec(cleaned);
  if (!match) return symbol;

  const useFlat = preferFlat || match[1].includes('b');
  const nextRoot = pcToNoteName(parsed.rootPc + semitones, useFlat);
  const quality = match[2] ?? '';
  if (match[3] && parsed.bassPc !== undefined) {
    const nextBass = pcToNoteName(parsed.bassPc + semitones, useFlat);
    return `${nextRoot}${quality}/${nextBass}`;
  }
  return `${nextRoot}${quality}`;
}

const MAJOR_SCALE = [0, 2, 4, 5, 7, 9, 11];
const MINOR_SCALE = [0, 2, 3, 5, 7, 8, 10];
const ROMAN_DEGREE_MAP: Record<string, number> = {
  I: 0,
  II: 1,
  III: 2,
  IV: 3,
  V: 4,
  VI: 5,
  VII: 6
};

export function parseKeyString(keyStr: string): { tonicPc: number; isMinor: boolean; preferFlat: boolean } | null {
  const cleaned = keyStr.trim().replace(/♯/g, '#').replace(/♭/g, 'b');
  const match = /^([A-G](?:#|b)?)\s*(major|maj|minor|min|m)?/i.exec(cleaned);
  if (!match) return null;
  const tonicPc = NOTE_TO_PC[match[1]];
  if (tonicPc === undefined) return null;
  const modeToken = (match[2] ?? 'major').toLowerCase();
  const isMinor = modeToken === 'minor' || modeToken === 'min' || modeToken === 'm';
  const preferFlat = match[1].includes('b') || (!isMinor && tonicPc === 5);
  return { tonicPc, isMinor, preferFlat };
}

function resolveRomanDegreePc(
  degreeToken: string,
  tonicPc: number,
  isMinor: boolean
): number | null {
  const match = /^([b#]*)(VII|VI|IV|V|III|II|I)$/i.exec(degreeToken);
  if (!match) return null;
  const accidentals = match[1];
  const romanUpper = match[2].toUpperCase();
  const degreeIdx = ROMAN_DEGREE_MAP[romanUpper];
  if (degreeIdx === undefined) return null;

  // When explicit accidentals (e.g. bVI, bIII, bVII) are given, resolve relative to the major scale
  // to avoid double-flatting in minor keys (Berklee / ChordTube convention).
  const baseScale = accidentals.length > 0 ? MAJOR_SCALE : isMinor ? MINOR_SCALE : MAJOR_SCALE;
  let offset = baseScale[degreeIdx];
  for (const ch of accidentals) {
    if (ch === 'b') offset -= 1;
    if (ch === '#') offset += 1;
  }
  return ((tonicPc + offset) % 12 + 12) % 12;
}

/**
 * Resolves a ChordTube Roman numeral (e.g. "IVM7", "IIIm", "V/VII", "bVImaj9") in a given key
 * into a concrete chord symbol (e.g. "FM7", "Em", "G/B", "Dmaj9").
 */
export function resolveRomanToChord(roman: string, keyStr: string): string | null {
  const key = parseKeyString(keyStr);
  if (!key) return null;

  const cleaned = normalizeChordText(roman);
  if (/^(N\.?C\.?|-)$/i.test(cleaned)) return 'N.C.';

  const [mainPart, bassPart] = cleaned.split('/');
  const match = /^([b#]*)(VII|VI|IV|V|III|II|I|vii|vi|iv|v|iii|ii|i)(.*)$/.exec(mainPart);
  if (!match) return null;

  const rootPc = resolveRomanDegreePc(`${match[1]}${match[2]}`, key.tonicPc, key.isMinor);
  if (rootPc === null) return null;

  const isLowercase = match[2] === match[2].toLowerCase();
  let quality = match[3] ?? '';
  if (isLowercase && !quality.startsWith('m') && !quality.startsWith('dim') && !quality.startsWith('-')) {
    quality = `m${quality}`;
  }

  const rootName = pcToNoteName(rootPc, key.preferFlat);
  let result = `${rootName}${quality}`;

  if (bassPart) {
    const bassPc = resolveRomanDegreePc(bassPart, key.tonicPc, key.isMinor);
    if (bassPc === null) return null;
    result += `/${pcToNoteName(bassPc, key.preferFlat)}`;
  }

  return isValidChordSymbol(result) ? result : null;
}

function clampMidi(pitch: number): number {
  return Math.max(0, Math.min(127, Math.round(pitch)));
}

function placeBassMidi(bassPc: number): number {
  // Place left-hand bass note cleanly in E2 (40) .. Eb3 (51)
  let midi = 36 + bassPc;
  if (midi < 40) midi += 12;
  return clampMidi(midi);
}

function buildRightHandCandidates(rootPc: number, intervals: number[]): number[][] {
  const baseNotes = intervals.map((interval) => 60 + rootPc + interval);
  // Normalize initial cluster around C4 (60) - C5 (72)
  const centered = baseNotes.map((n) => {
    let v = n;
    while (v > 76) v -= 12;
    while (v < 55) v += 12;
    return v;
  });

  const uniquePcs = Array.from(new Set(intervals.map((i) => (rootPc + i) % 12)));
  const candidates: number[][] = [];

  for (let inv = 0; inv < uniquePcs.length; inv++) {
    const rotated = [...uniquePcs.slice(inv), ...uniquePcs.slice(0, inv)];
    for (const anchorOctave of [48, 60]) {
      const voicing: number[] = [];
      let prev = anchorOctave - 1;
      for (const pc of rotated) {
        let note = anchorOctave + pc;
        while (note <= prev) note += 12;
        voicing.push(note);
        prev = note;
      }
      const avg = voicing.reduce((s, n) => s + n, 0) / voicing.length;
      if (avg >= 58 && avg <= 74) {
        candidates.push(voicing);
      }
    }
  }

  if (candidates.length === 0) {
    candidates.push(Array.from(new Set(centered)).sort((a, b) => a - b));
  }
  return candidates;
}

function voiceLeadingDistance(prev: number[], next: number[]): number {
  let cost = 0;
  for (const n of next) {
    let best = 127;
    for (const p of prev) {
      const d = Math.abs(n - p);
      if (d < best) best = d;
    }
    cost += best;
  }
  const prevAvg = prev.reduce((s, n) => s + n, 0) / prev.length;
  const nextAvg = next.reduce((s, n) => s + n, 0) / next.length;
  return cost + Math.abs(nextAvg - prevAvg) * 1.5;
}

function buildVoicingForChord(
  parsed: ParsedChord,
  transpose: number,
  style: VoicingStyle,
  prevRightHand: number[] | null
): { bass: number; rightHand: number[] } {
  const rootPc = ((parsed.rootPc! + transpose) % 12 + 12) % 12;
  const bassPc = ((parsed.bassPc! + transpose) % 12 + 12) % 12;
  const bass = placeBassMidi(bassPc);

  if (style === 'root') {
    const rightHand = parsed.intervals.map((interval) => {
      let note = 60 + rootPc + interval;
      if (rootPc >= 8) note -= 12;
      return clampMidi(note);
    });
    return { bass, rightHand };
  }

  if (style === 'open') {
    const rightHand = parsed.intervals.map((interval, idx) => {
      let note = 57 + rootPc + interval;
      if (idx === 1) note += 12; // Lift the 3rd up an octave for open spread
      while (note < 55) note += 12;
      while (note > 82) note -= 12;
      return clampMidi(note);
    });
    return { bass, rightHand: Array.from(new Set(rightHand)).sort((a, b) => a - b) };
  }

  // 'smooth' and 'arpeggio' use smooth voice leading
  const candidates = buildRightHandCandidates(rootPc, parsed.intervals);
  let chosen = candidates[0];
  if (prevRightHand && prevRightHand.length > 0) {
    let bestDist = Infinity;
    for (const cand of candidates) {
      const d = voiceLeadingDistance(prevRightHand, cand);
      if (d < bestDist) {
        bestDist = d;
        chosen = cand;
      }
    }
  } else {
    // Pick candidate closest to middle C-G4 (64)
    let bestCenter = Infinity;
    for (const cand of candidates) {
      const avg = cand.reduce((s, n) => s + n, 0) / cand.length;
      const dist = Math.abs(avg - 65);
      if (dist < bestCenter) {
        bestCenter = dist;
        chosen = cand;
      }
    }
  }

  return { bass, rightHand: chosen.map(clampMidi) };
}

export interface GeneratePianoOptions {
  key?: string;
  transpose?: number;
  voicing?: VoicingStyle;
  beatsPerBar?: number;
}

/**
 * Deterministically converts a chord progression into a single-track Piano MIDI note sequence.
 */
export function generatePianoSequence(
  chords: ChordInput[],
  options: GeneratePianoOptions = {}
): GeneratedPianoSequence {
  const transpose = options.transpose ?? 0;
  const voicing = options.voicing ?? 'arpeggio';
  const beatsPerBar = options.beatsPerBar ?? 4;
  const firstBar = chords.find((chord) => chord.bar !== undefined)?.bar;
  const notes: PianoNote[] = [];
  const chordSpans: ChordSpan[] = [];

  let cursor = 0;
  let prevRightHand: number[] | null = null;

  for (let i = 0; i < chords.length; i++) {
    const item = chords[i];
    const beats = Math.max(0.25, item.beats);
    const startBeat = item.bar !== undefined && firstBar !== undefined
      ? (item.bar - firstBar) * beatsPerBar + (item.beatOffset ?? 0)
      : cursor;
    let symbolToParse = item.symbol.trim();
    if (!symbolToParse && item.roman && options.key) {
      symbolToParse = resolveRomanToChord(item.roman, options.key) ?? '';
    }

    const parsed = parseChordSymbol(symbolToParse);
    if (!parsed) {
      throw new Error(`Unsupported chord symbol "${item.symbol}" at index ${i}`);
    }

    const displaySymbol = parsed.isRest
      ? 'N.C.'
      : transposeChordSymbol(symbolToParse, transpose);

    chordSpans.push({
      index: i,
      originalSymbol: symbolToParse,
      displaySymbol,
      roman: item.roman,
      startBeat,
      endBeat: startBeat + beats,
      beats,
      isRest: parsed.isRest
    });

    if (!parsed.isRest) {
      const { bass, rightHand } = buildVoicingForChord(parsed, transpose, voicing, prevRightHand);
      prevRightHand = rightHand;

      const sustainDur = Math.max(0.15, beats);

      if (voicing === 'arpeggio') {
        notes.push({
          midi: bass,
          startBeat,
          durationBeats: sustainDur,
          velocity: 0.52,
          chordIndex: i
        });

        const step = 0.5;
        const pattern =
          rightHand.length > 2
            ? [...rightHand, ...rightHand.slice(1, -1).reverse()]
            : rightHand;
        const stepCount = Math.max(1, Math.floor(beats / step));
        for (let s = 0; s < stepCount; s++) {
          const noteStart = startBeat + s * step;
          const remaining = startBeat + beats - noteStart;
          notes.push({
            midi: pattern[s % pattern.length],
            startBeat: noteStart,
            durationBeats: Math.min(step * 1.35, Math.max(0.15, remaining)),
            velocity: s === 0 ? 0.56 : 0.46,
            chordIndex: i
          });
        }
      } else {
        notes.push({
          midi: bass,
          startBeat,
          durationBeats: sustainDur,
          velocity: 0.52,
          chordIndex: i
        });
        for (let idx = 0; idx < rightHand.length; idx++) {
          notes.push({
            midi: rightHand[idx],
            startBeat,
            durationBeats: sustainDur,
            velocity: idx === rightHand.length - 1 ? 0.5 : 0.44,
            chordIndex: i
          });
        }
      }
    }

    cursor = Math.max(cursor, startBeat + beats);
  }

  // Merge same-pitch notes that touch or overlap so anticipations remain tied
  // across a bar line rather than being retriggered with a small gap.
  const mergedNotes: PianoNote[] = [];
  const lastByPitch = new Map<number, PianoNote>();
  for (const note of [...notes].sort((a, b) => a.startBeat - b.startBeat)) {
    const previous = lastByPitch.get(note.midi);
    if (previous && note.startBeat <= previous.startBeat + previous.durationBeats + 0.001) {
      const end = Math.max(
        previous.startBeat + previous.durationBeats,
        note.startBeat + note.durationBeats
      );
      previous.durationBeats = end - previous.startBeat;
    } else {
      const copy = { ...note };
      mergedNotes.push(copy);
      lastByPitch.set(copy.midi, copy);
    }
  }

  return { notes: mergedNotes, chordSpans, totalBeats: cursor };
}

export function parseTimeSignature(ts: string): [number, number] {
  const match = /^(\d+)\/(\d+)$/.exec(ts.trim());
  if (!match) return [4, 4];
  const num = Number(match[1]);
  const den = Number(match[2]);
  return num > 0 && den > 0 ? [num, den] : [4, 4];
}

export interface ExportChordSmfOptions extends GeneratePianoOptions {
  name?: string;
  bpm: number;
  timeSignature?: string;
}

/**
 * Parses quick text notation like "FM7(2) E7(2) Am7(2) Gm7(1) C7(1)" or "IVM7(2) III7(2)" (with key).
 */
export function parseQuickChordLine(input: string, keyForRoman?: string): ChordInput[] {
  const tokens = input
    .trim()
    .split(/[\s,|→>]+/)
    .map((t) => t.trim())
    .filter(Boolean);

  const result: ChordInput[] = [];
  for (const token of tokens) {
    const match = /^(.+?)(?:\((\d+(?:\.\d+)?)\))?$/.exec(token);
    if (!match) {
      throw new Error(`Invalid chord token: "${token}"`);
    }
    const rawSym = match[1].trim();
    const beats = match[2] ? Number(match[2]) : 4;
    if (!Number.isFinite(beats) || beats <= 0 || beats > 32) {
      throw new Error(`Invalid beat duration in "${token}" (must be > 0 and <= 32)`);
    }

    if (isValidChordSymbol(rawSym)) {
      result.push({ symbol: rawSym, beats });
    } else if (keyForRoman) {
      const resolved = resolveRomanToChord(rawSym, keyForRoman);
      if (resolved) {
        result.push({ symbol: resolved, roman: rawSym, beats });
      } else {
        throw new Error(`Unrecognized chord or Roman numeral: "${rawSym}"`);
      }
    } else {
      throw new Error(`Unrecognized chord symbol: "${rawSym}"`);
    }
  }

  return result;
}
