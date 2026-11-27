import { Midi } from '@tonejs/midi';
import {
  generatePianoSequence,
  parseTimeSignature,
  type ChordInput,
  type ExportChordSmfOptions
} from './chordEngine';

/**
 * Exports a chord progression as a single-track Piano Standard MIDI File (.mid).
 */
export function chordProgressionToSmf(
  chords: ChordInput[],
  options: ExportChordSmfOptions
): Uint8Array {
  const seq = generatePianoSequence(chords, options);
  const midi = new Midi();
  const ppq = midi.header.ppq;
  const [tsNum, tsDen] = parseTimeSignature(options.timeSignature ?? '4/4');

  midi.header.name = options.name ?? 'Chord Progression';
  midi.header.setTempo(options.bpm);
  midi.header.timeSignatures.push({
    ticks: 0,
    timeSignature: [tsNum, tsDen],
    measures: 0
  });

  const track = midi.addTrack();
  track.name = 'Piano';
  track.channel = 0;
  track.instrument.number = 0;

  for (const n of seq.notes) {
    track.addNote({
      midi: Math.max(0, Math.min(127, Math.round(n.midi))),
      ticks: Math.max(0, Math.round(n.startBeat * ppq)),
      durationTicks: Math.max(1, Math.round(n.durationBeats * ppq)),
      velocity: Math.max(0.05, Math.min(1, n.velocity))
    });
  }

  return midi.toArray();
}

export function triggerChordSmfDownload(
  chords: ChordInput[],
  options: ExportChordSmfOptions
): void {
  const bytes = chordProgressionToSmf(chords, options);
  const copy = new Uint8Array(bytes.byteLength);
  copy.set(bytes);
  const blob = new Blob([copy.buffer], { type: 'audio/midi' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  const safeName = (options.name ?? 'chord-progression')
    .toLowerCase()
    .replace(/[^a-z0-9-_]+/g, '-')
    .replace(/^-+|-+$/g, '');
  link.href = url;
  link.download = `${safeName || 'chord-progression'}.mid`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
