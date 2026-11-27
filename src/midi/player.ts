import * as Tone from 'tone';
import {
  generatePianoSequence,
  type ChordInput,
  type GeneratedPianoSequence,
  type VoicingStyle
} from './chordEngine';

export interface PianoPlaybackOptions {
  bpm: number;
  key?: string;
  transpose: number;
  voicing: VoicingStyle;
  beatsPerBar?: number;
  loop: boolean;
  onProgress?: (currentBeat: number, activeChordIndex: number | null) => void;
  onEnd?: () => void;
}

class PianoChordPlayer {
  private piano: Tone.PolySynth | null = null;
  private scheduledPart: Tone.Part | null = null;
  private rafId: number | null = null;
  private endEventId: number | null = null;
  private isPlayingState = false;
  private activeBpm = 120;
  private activeLoop = false;
  private activeSequence: GeneratedPianoSequence | null = null;
  private onProgressCb: ((currentBeat: number, activeChordIndex: number | null) => void) | undefined;

  private ensureSynth(): void {
    if (!this.piano) {
      const limiter = new Tone.Limiter(-6).toDestination();
      const reverb = new Tone.Reverb({ decay: 1.2, wet: 0.1 }).connect(limiter);
      const filter = new Tone.Filter(4200, 'lowpass').connect(reverb);
      this.piano = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle8' },
        envelope: { attack: 0.012, decay: 0.45, sustain: 0.4, release: 1.1 }
      }).connect(filter);
      this.piano.volume.value = -10;
    }
  }

  async play(chords: ChordInput[], options: PianoPlaybackOptions): Promise<void> {
    this.stop();
    await Tone.start();
    this.ensureSynth();

    const seq = generatePianoSequence(chords, {
      key: options.key,
      transpose: options.transpose,
      voicing: options.voicing,
      beatsPerBar: options.beatsPerBar
    });

    const totalBeats = Math.max(1, seq.totalBeats);
    const secPerBeat = 60 / options.bpm;
    const totalSec = totalBeats * secPerBeat;

    this.activeBpm = options.bpm;
    this.activeLoop = options.loop;
    this.activeSequence = seq;
    this.onProgressCb = options.onProgress;

    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel(0);
    transport.bpm.value = options.bpm;
    transport.loop = options.loop;
    transport.loopStart = 0;
    transport.loopEnd = totalSec;

    interface ScheduledNote {
      time: number;
      midi: number;
      durationSec: number;
      velocity: number;
    }

    const events: ScheduledNote[] = seq.notes.map((n) => ({
      time: n.startBeat * secPerBeat,
      midi: n.midi,
      durationSec: Math.max(0.05, n.durationBeats * secPerBeat),
      velocity: n.velocity
    }));

    this.scheduledPart = new Tone.Part<ScheduledNote>((time, ev) => {
      const freq = Tone.Frequency(ev.midi, 'midi').toFrequency();
      this.piano?.triggerAttackRelease(freq, ev.durationSec, time, ev.velocity);
    }, events);

    this.scheduledPart.start(0);

    if (!options.loop) {
      this.endEventId = transport.scheduleOnce(() => {
        Tone.getDraw().schedule(() => {
          this.stop();
          options.onEnd?.();
        }, Tone.now());
      }, totalSec + 0.15);
    }

    this.isPlayingState = true;
    transport.start('+0.03', 0);
    this.startProgressLoop();
  }

  private startProgressLoop(): void {
    const tick = () => {
      if (!this.isPlayingState || !this.activeSequence) return;
      const transport = Tone.getTransport();
      const secPerBeat = 60 / this.activeBpm;
      const totalBeats = Math.max(1, this.activeSequence.totalBeats);
      const rawBeat = transport.seconds / secPerBeat;
      const currentBeat = this.activeLoop ? rawBeat % totalBeats : Math.min(totalBeats, rawBeat);

      const activeSpan = this.activeSequence.chordSpans.find(
        (span) => currentBeat >= span.startBeat && currentBeat < span.endBeat
      );
      this.onProgressCb?.(currentBeat, activeSpan ? activeSpan.index : null);
      this.rafId = window.requestAnimationFrame(tick);
    };
    this.rafId = window.requestAnimationFrame(tick);
  }

  stop(): void {
    this.isPlayingState = false;
    if (this.rafId !== null) {
      window.cancelAnimationFrame(this.rafId);
      this.rafId = null;
    }
    const transport = Tone.getTransport();
    if (this.endEventId !== null) {
      transport.clear(this.endEventId);
      this.endEventId = null;
    }
    if (this.scheduledPart) {
      this.scheduledPart.dispose();
      this.scheduledPart = null;
    }
    transport.stop();
    transport.cancel(0);
    this.piano?.releaseAll();
    this.onProgressCb?.(0, null);
  }
}

export const pianoPlayer = new PianoChordPlayer();
