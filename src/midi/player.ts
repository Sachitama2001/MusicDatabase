import * as Tone from 'tone';
import type { MidiClip, MidiRole } from '../schema';
import { getClipTotalBeats, transposeMidiClip } from './converter';

export interface PlaybackOptions {
  bpm: number;
  transpose: number;
  loop: boolean;
  mutedRoles: ReadonlySet<MidiRole>;
  soloRole: MidiRole | null;
  onProgress?: (currentBeat: number, totalBeats: number) => void;
  onEnd?: () => void;
}

class MidiClipPlayer {
  private piano: Tone.PolySynth | null = null;
  private bass: Tone.PolySynth | null = null;
  private kick: Tone.MembraneSynth | null = null;
  private snare: Tone.NoiseSynth | null = null;
  private hat: Tone.NoiseSynth | null = null;
  private cymbal: Tone.MetalSynth | null = null;

  private scheduledPart: Tone.Part | null = null;
  private rafId: number | null = null;
  private endEventId: number | null = null;
  private isPlayingState = false;
  private activeBpm = 120;
  private activeTotalBeats = 16;
  private activeLoop = false;
  private onProgressCb: ((currentBeat: number, totalBeats: number) => void) | undefined;

  private ensureSynths(): void {
    if (!this.piano) {
      const pianoFilter = new Tone.Filter(3800, 'lowpass').toDestination();
      this.piano = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'triangle8' },
        envelope: { attack: 0.015, decay: 0.35, sustain: 0.45, release: 0.9 }
      }).connect(pianoFilter);
      this.piano.volume.value = -6;
    }

    if (!this.bass) {
      const bassFilter = new Tone.Filter(950, 'lowpass').toDestination();
      this.bass = new Tone.PolySynth(Tone.Synth, {
        oscillator: { type: 'sawtooth' },
        envelope: { attack: 0.01, decay: 0.2, sustain: 0.65, release: 0.25 }
      }).connect(bassFilter);
      this.bass.volume.value = -5;
    }

    if (!this.kick) {
      this.kick = new Tone.MembraneSynth({
        pitchDecay: 0.04,
        octaves: 5,
        oscillator: { type: 'sine' },
        envelope: { attack: 0.002, decay: 0.28, sustain: 0.01, release: 0.2 }
      }).toDestination();
      this.kick.volume.value = -2;
    }

    if (!this.snare) {
      const snareFilter = new Tone.Filter(1800, 'bandpass').toDestination();
      this.snare = new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: { attack: 0.002, decay: 0.14, sustain: 0, release: 0.08 }
      }).connect(snareFilter);
      this.snare.volume.value = -7;
    }

    if (!this.hat) {
      const hatFilter = new Tone.Filter(7500, 'highpass').toDestination();
      this.hat = new Tone.NoiseSynth({
        noise: { type: 'white' },
        envelope: { attack: 0.001, decay: 0.045, sustain: 0, release: 0.03 }
      }).connect(hatFilter);
      this.hat.volume.value = -13;
    }

    if (!this.cymbal) {
      this.cymbal = new Tone.MetalSynth({
        envelope: { attack: 0.002, decay: 0.4, release: 0.2 },
        harmonicity: 5.1,
        modulationIndex: 32,
        resonance: 4000,
        octaves: 1.5
      }).toDestination();
      this.cymbal.volume.value = -18;
    }
  }

  private triggerDrum(midiNote: number, time: number, velocity: number): void {
    const v = Math.max(0.1, Math.min(1, velocity));
    if (midiNote === 35 || midiNote === 36) {
      this.kick?.triggerAttackRelease('C1', '8n', time, v);
    } else if (midiNote === 38 || midiNote === 39 || midiNote === 40) {
      this.snare?.triggerAttackRelease('16n', time, v);
    } else if (midiNote === 49 || midiNote === 51 || midiNote === 52 || midiNote === 57) {
      this.cymbal?.triggerAttackRelease('C6', '8n', time, v * 0.7);
    } else if (midiNote === 46) {
      this.hat?.triggerAttackRelease('8n', time, v * 0.9);
    } else {
      this.hat?.triggerAttackRelease('32n', time, v * 0.75);
    }
  }

  private isRoleAudible(role: MidiRole, options: PlaybackOptions): boolean {
    if (options.soloRole !== null) {
      return options.soloRole === role;
    }
    return !options.mutedRoles.has(role);
  }

  async play(clip: MidiClip, options: PlaybackOptions): Promise<void> {
    this.stop();
    await Tone.start();
    this.ensureSynths();

    const effectiveClip = transposeMidiClip(clip, options.transpose);
    const totalBeats = Math.max(1, getClipTotalBeats(effectiveClip));
    const secPerBeat = 60 / options.bpm;
    const totalSec = totalBeats * secPerBeat;

    this.activeBpm = options.bpm;
    this.activeTotalBeats = totalBeats;
    this.activeLoop = options.loop;
    this.onProgressCb = options.onProgress;

    const transport = Tone.getTransport();
    transport.stop();
    transport.cancel(0);
    transport.bpm.value = options.bpm;
    transport.loop = options.loop;
    transport.loopStart = 0;
    transport.loopEnd = totalSec;

    interface ScheduledEvent {
      time: number;
      role: MidiRole;
      midi: number;
      durationSec: number;
      velocity: number;
    }

    const events: ScheduledEvent[] = [];
    for (const track of effectiveClip.tracks) {
      if (!this.isRoleAudible(track.role, options)) continue;
      for (const note of track.notes) {
        events.push({
          time: note.startBeat * secPerBeat,
          role: track.role,
          midi: note.midi,
          durationSec: Math.max(0.03, note.durationBeats * secPerBeat),
          velocity: note.velocity
        });
      }
    }

    this.scheduledPart = new Tone.Part<ScheduledEvent>((time, ev) => {
      if (ev.role === 'piano') {
        const freq = Tone.Frequency(ev.midi, 'midi').toFrequency();
        this.piano?.triggerAttackRelease(freq, ev.durationSec, time, ev.velocity);
      } else if (ev.role === 'bass') {
        const freq = Tone.Frequency(ev.midi, 'midi').toFrequency();
        this.bass?.triggerAttackRelease(freq, ev.durationSec, time, ev.velocity);
      } else if (ev.role === 'drum') {
        this.triggerDrum(ev.midi, time, ev.velocity);
      }
    }, events);

    this.scheduledPart.start(0);

    if (!options.loop) {
      this.endEventId = transport.scheduleOnce(() => {
        Tone.getDraw().schedule(() => {
          this.stop();
          options.onEnd?.();
        }, Tone.now());
      }, totalSec + 0.1);
    }

    this.isPlayingState = true;
    transport.start('+0.03', 0);
    this.startProgressLoop();
  }

  private startProgressLoop(): void {
    const tick = () => {
      if (!this.isPlayingState) return;
      const transport = Tone.getTransport();
      const secPerBeat = 60 / this.activeBpm;
      const currentBeat = transport.seconds / secPerBeat;
      const clampedBeat = this.activeLoop
        ? currentBeat % this.activeTotalBeats
        : Math.min(this.activeTotalBeats, currentBeat);
      this.onProgressCb?.(clampedBeat, this.activeTotalBeats);
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
    this.bass?.releaseAll();
    this.onProgressCb?.(0, this.activeTotalBeats);
  }
}

export const midiPlayer = new MidiClipPlayer();
