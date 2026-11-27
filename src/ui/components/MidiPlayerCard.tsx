import { useEffect, useMemo, useState } from 'react';
import type { MidiClip, MidiRole } from '../../schema';
import {
  getBeatsPerBar,
  getClipTotalBeats,
  transposeMidiClip,
  triggerSmfDownload
} from '../../midi/converter';
import { midiPlayer } from '../../midi/player';

interface MidiPlayerCardProps {
  clip: MidiClip;
  label?: string;
  onNotify?: (message: string) => void;
  onOpenInStudio?: (clip: MidiClip) => void;
}

const ROLE_COLORS: Record<MidiRole, string> = {
  piano: '#60a5fa',
  bass: '#a78bfa',
  drum: '#fb923c'
};

export function MidiPlayerCard({
  clip,
  label,
  onNotify,
  onOpenInStudio
}: MidiPlayerCardProps) {
  const [bpm, setBpm] = useState<number>(clip.bpm);
  const [transpose, setTranspose] = useState<number>(0);
  const [loop, setLoop] = useState<boolean>(true);
  const [mutedRoles, setMutedRoles] = useState<Set<MidiRole>>(new Set());
  const [soloRole, setSoloRole] = useState<MidiRole | null>(null);
  const [isPlaying, setIsPlaying] = useState<boolean>(false);
  const [playheadBeat, setPlayheadBeat] = useState<number>(0);

  useEffect(() => {
    setBpm(clip.bpm);
    setTranspose(0);
    setPlayheadBeat(0);
    setIsPlaying(false);
  }, [clip]);

  useEffect(() => {
    return () => {
      midiPlayer.stop();
    };
  }, []);

  const previewClip = useMemo(() => transposeMidiClip(clip, transpose), [clip, transpose]);
  const totalBeats = useMemo(() => Math.max(1, getClipTotalBeats(previewClip)), [previewClip]);
  const beatsPerBar = useMemo(
    () => getBeatsPerBar(previewClip.timeSignature),
    [previewClip.timeSignature]
  );

  const pitchBounds = useMemo(() => {
    let min = 127;
    let max = 0;
    for (const track of previewClip.tracks) {
      for (const n of track.notes) {
        if (n.midi < min) min = n.midi;
        if (n.midi > max) max = n.midi;
      }
    }
    if (min > max) return { min: 36, max: 84 };
    return { min: Math.max(0, min - 3), max: Math.min(127, max + 3) };
  }, [previewClip]);

  const effectiveMuted = useMemo(() => {
    if (soloRole === null) return mutedRoles;
    const muted = new Set<MidiRole>();
    for (const role of ['piano', 'bass', 'drum'] as MidiRole[]) {
      if (role !== soloRole) muted.add(role);
    }
    return muted;
  }, [mutedRoles, soloRole]);

  async function startPlayback(overrides?: {
    bpm?: number;
    transpose?: number;
    loop?: boolean;
    muted?: Set<MidiRole>;
    solo?: MidiRole | null;
  }) {
    const nextBpm = overrides?.bpm ?? bpm;
    const nextTranspose = overrides?.transpose ?? transpose;
    const nextLoop = overrides?.loop ?? loop;
    const nextMuted = overrides?.muted ?? mutedRoles;
    const nextSolo = overrides?.solo !== undefined ? overrides.solo : soloRole;

    setIsPlaying(true);
    try {
      await midiPlayer.play(clip, {
        bpm: nextBpm,
        transpose: nextTranspose,
        loop: nextLoop,
        mutedRoles: nextMuted,
        soloRole: nextSolo,
        onProgress: (beat) => setPlayheadBeat(beat),
        onEnd: () => {
          setIsPlaying(false);
          setPlayheadBeat(0);
        }
      });
    } catch (err) {
      setIsPlaying(false);
      onNotify?.(`再生に失敗しました: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function handleStop() {
    midiPlayer.stop();
    setIsPlaying(false);
    setPlayheadBeat(0);
  }

  function toggleMute(role: MidiRole) {
    const next = new Set(mutedRoles);
    if (next.has(role)) next.delete(role);
    else next.add(role);
    setMutedRoles(next);
    if (isPlaying) {
      void startPlayback({ muted: next });
    }
  }

  function toggleSolo(role: MidiRole) {
    const next = soloRole === role ? null : role;
    setSoloRole(next);
    if (isPlaying) {
      void startPlayback({ solo: next });
    }
  }

  function handleTransposeChange(delta: number) {
    const next = Math.max(-12, Math.min(12, transpose + delta));
    setTranspose(next);
    if (isPlaying) {
      void startPlayback({ transpose: next });
    }
  }

  function handleBpmChange(nextBpm: number) {
    const clamped = Math.max(20, Math.min(350, nextBpm));
    setBpm(clamped);
    if (isPlaying) {
      void startPlayback({ bpm: clamped });
    }
  }

  function handleCopyJson() {
    const json = JSON.stringify(previewClip, null, 2);
    void navigator.clipboard.writeText(json).then(() => {
      onNotify?.('MidiClip JSONをクリップボードへコピーしました');
    });
  }

  function handleDownloadMid() {
    triggerSmfDownload(clip, {
      bpmOverride: bpm,
      transpose,
      mutedRoles: effectiveMuted
    });
    onNotify?.('.midファイルを書き出しました');
  }

  const svgWidth = 720;
  const svgHeight = 136;
  const pitchSpan = Math.max(12, pitchBounds.max - pitchBounds.min);

  return (
    <div className="midi-card">
      <div className="card-header" style={{ marginBottom: 8 }}>
        <div>
          <strong>{label ? `${label}: ` : ''}{clip.name}</strong>
          <div className="meta-inline">
            <span>{clip.bars} bars</span>
            <span>{clip.timeSignature}</span>
            {clip.key && <span>Key: {clip.key}</span>}
            <span>Orig BPM: {clip.bpm}</span>
          </div>
        </div>
        <div className="action-row" style={{ marginTop: 0 }}>
          <button type="button" className="btn btn-sm" onClick={handleCopyJson}>
            JSONコピー
          </button>
          <button type="button" className="btn btn-sm btn-primary" onClick={handleDownloadMid}>
            .midダウンロード
          </button>
          {onOpenInStudio && (
            <button
              type="button"
              className="btn btn-sm"
              onClick={() => onOpenInStudio(clip)}
            >
              MIDIスタジオで開く
            </button>
          )}
        </div>
      </div>

      <div className="midi-controls">
        {!isPlaying ? (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => void startPlayback()}
          >
            再生
          </button>
        ) : (
          <button type="button" className="btn btn-sm" onClick={handleStop}>
            停止
          </button>
        )}

        <button
          type="button"
          className={`btn btn-sm ${loop ? 'btn-active' : ''}`}
          onClick={() => {
            const nextLoop = !loop;
            setLoop(nextLoop);
            if (isPlaying) void startPlayback({ loop: nextLoop });
          }}
        >
          Loop: {loop ? 'ON' : 'OFF'}
        </button>

        <div className="control-group">
          <span>BPM</span>
          <input
            type="number"
            aria-label="BPM"
            min={20}
            max={350}
            value={bpm}
            onChange={(e) => handleBpmChange(Number(e.target.value) || clip.bpm)}
            style={{ width: 62, background: 'transparent', border: 'none', textAlign: 'right' }}
          />
        </div>

        <div className="control-group" title="Drumトラックは移調対象外です">
          <span>Transpose</span>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => handleTransposeChange(-1)}
          >
            -1
          </button>
          <span style={{ minWidth: 32, textAlign: 'center', fontFamily: 'var(--mono)' }}>
            {transpose > 0 ? `+${transpose}` : transpose}
          </span>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => handleTransposeChange(1)}
          >
            +1
          </button>
          <span className="muted" style={{ fontSize: '0.72rem' }}>
            Drum除外
          </span>
        </div>
      </div>

      <div className="track-mixer">
        {clip.tracks.map((track, idx) => {
          const isMuted = effectiveMuted.has(track.role);
          const isSolo = soloRole === track.role;
          return (
            <div className="track-pill" key={`${track.role}-${idx}`}>
              <span className={`role-dot role-${track.role}`} />
              <span style={{ textTransform: 'capitalize' }}>{track.role}</span>
              <span className="muted">({track.notes.length})</span>
              <button
                type="button"
                className={`btn btn-sm ${mutedRoles.has(track.role) ? 'btn-active' : ''}`}
                onClick={() => toggleMute(track.role)}
                title="Mute"
                style={{ padding: '1px 6px', fontSize: '0.72rem' }}
              >
                M
              </button>
              <button
                type="button"
                className={`btn btn-sm ${isSolo ? 'btn-active' : ''}`}
                onClick={() => toggleSolo(track.role)}
                title="Solo"
                style={{ padding: '1px 6px', fontSize: '0.72rem' }}
              >
                S
              </button>
              {isMuted && <span className="muted" style={{ fontSize: '0.7rem' }}>muted</span>}
            </div>
          );
        })}
      </div>

      <div className="pianoroll-wrap">
        <svg
          className="pianoroll-svg"
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`${clip.name} piano roll preview`}
        >
          {Array.from({ length: Math.ceil(totalBeats) + 1 }).map((_, beat) => {
            const x = (beat / totalBeats) * svgWidth;
            const isBarLine = beat % beatsPerBar === 0;
            return (
              <line
                key={beat}
                x1={x}
                y1={0}
                x2={x}
                y2={svgHeight}
                stroke={isBarLine ? '#2c3345' : '#181c27'}
                strokeWidth={isBarLine ? 1.4 : 0.8}
              />
            );
          })}

          {previewClip.tracks.map((track, tIdx) => {
            const muted = effectiveMuted.has(track.role);
            return track.notes.map((note, nIdx) => {
              const x = (note.startBeat / totalBeats) * svgWidth;
              const w = Math.max(3, (note.durationBeats / totalBeats) * svgWidth - 1);
              const normalizedPitch = (note.midi - pitchBounds.min) / pitchSpan;
              const y = svgHeight - 8 - normalizedPitch * (svgHeight - 16);
              return (
                <rect
                  key={`${tIdx}-${nIdx}`}
                  x={x}
                  y={y}
                  width={w}
                  height={5}
                  rx={1.5}
                  fill={ROLE_COLORS[track.role]}
                  opacity={muted ? 0.16 : 0.45 + note.velocity * 0.55}
                />
              );
            });
          })}

          {isPlaying && (
            <line
              x1={(playheadBeat / totalBeats) * svgWidth}
              y1={0}
              x2={(playheadBeat / totalBeats) * svgWidth}
              y2={svgHeight}
              stroke="#34d399"
              strokeWidth={2}
            />
          )}
        </svg>
      </div>
    </div>
  );
}
