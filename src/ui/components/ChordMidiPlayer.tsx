import { useEffect, useMemo, useState } from 'react';
import {
  generatePianoSequence,
  parseTimeSignature,
  type ChordInput,
  type VoicingStyle
} from '../../midi/chordEngine';
import { triggerChordSmfDownload } from '../../midi/smfExport';
import { pianoPlayer } from '../../midi/player';

interface ChordMidiPlayerProps {
  title: string;
  chords: ChordInput[];
  defaultBpm: number;
  baseKey?: string;
  timeSignature?: string;
  onNotify?: (msg: string) => void;
  onSendToLab?: (quickLine: string, bpm: number, key: string) => void;
}

const VOICING_OPTIONS: Array<{ value: VoicingStyle; label: string }> = [
  { value: 'smooth', label: 'Smooth (ボイスリーディング)' },
  { value: 'root', label: 'Root (基本形)' },
  { value: 'open', label: 'Open (広がり)' },
  { value: 'arpeggio', label: 'Arpeggio (分散和音)' }
];

export function ChordMidiPlayer({
  title,
  chords,
  defaultBpm,
  baseKey,
  timeSignature = '4/4',
  onNotify,
  onSendToLab
}: ChordMidiPlayerProps) {
  const [bpm, setBpm] = useState(defaultBpm);
  const [transpose, setTranspose] = useState(0);
  const [voicing, setVoicing] = useState<VoicingStyle>('smooth');
  const [loop, setLoop] = useState(true);
  const [isPlaying, setIsPlaying] = useState(false);
  const [playheadBeat, setPlayheadBeat] = useState(0);
  const [activeChordIdx, setActiveChordIdx] = useState<number | null>(null);

  useEffect(() => {
    setBpm(defaultBpm);
    setTranspose(0);
    setPlayheadBeat(0);
    setActiveChordIdx(null);
    setIsPlaying(false);
  }, [chords, defaultBpm]);

  useEffect(() => {
    return () => {
      pianoPlayer.stop();
    };
  }, []);

  const generated = useMemo(() => {
    try {
      const seq = generatePianoSequence(chords, {
        key: baseKey,
        transpose,
        voicing
      });
      return { ok: true as const, seq };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : String(err)
      };
    }
  }, [chords, baseKey, transpose, voicing]);

  const beatsPerBar = useMemo(() => {
    const [num, den] = parseTimeSignature(timeSignature);
    return num * (4 / den);
  }, [timeSignature]);

  const pitchBounds = useMemo(() => {
    if (!generated.ok || generated.seq.notes.length === 0) return { min: 40, max: 80 };
    let min = 127;
    let max = 0;
    for (const n of generated.seq.notes) {
      if (n.midi < min) min = n.midi;
      if (n.midi > max) max = n.midi;
    }
    return { min: Math.max(0, min - 3), max: Math.min(127, max + 3) };
  }, [generated]);

  async function startPlayback(overrides?: {
    bpm?: number;
    transpose?: number;
    voicing?: VoicingStyle;
    loop?: boolean;
  }) {
    const nextBpm = overrides?.bpm ?? bpm;
    const nextTranspose = overrides?.transpose ?? transpose;
    const nextVoicing = overrides?.voicing ?? voicing;
    const nextLoop = overrides?.loop ?? loop;

    setIsPlaying(true);
    try {
      await pianoPlayer.play(chords, {
        bpm: nextBpm,
        key: baseKey,
        transpose: nextTranspose,
        voicing: nextVoicing,
        loop: nextLoop,
        onProgress: (beat, chordIdx) => {
          setPlayheadBeat(beat);
          setActiveChordIdx(chordIdx);
        },
        onEnd: () => {
          setIsPlaying(false);
          setPlayheadBeat(0);
          setActiveChordIdx(null);
        }
      });
    } catch (err) {
      setIsPlaying(false);
      onNotify?.(`再生に失敗しました: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function handleStop() {
    pianoPlayer.stop();
    setIsPlaying(false);
    setPlayheadBeat(0);
    setActiveChordIdx(null);
  }

  function handleDownloadMid() {
    try {
      triggerChordSmfDownload(chords, {
        name: title,
        bpm,
        key: baseKey,
        timeSignature,
        transpose,
        voicing
      });
      onNotify?.(`Piano .mid を書き出しました (BPM ${bpm}, Transpose ${transpose >= 0 ? `+${transpose}` : transpose}, ${voicing})`);
    } catch (err) {
      onNotify?.(`MIDI書き出しに失敗しました: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  function handleCopyQuickLine() {
    if (!generated.ok) return;
    const line = generated.seq.chordSpans
      .map((s) => `${s.displaySymbol}(${s.beats})`)
      .join(' ');
    void navigator.clipboard.writeText(line).then(() => {
      onNotify?.(`コード列をコピーしました: ${line}`);
    });
  }

  if (!generated.ok) {
    return <div className="status-banner status-error">コード解析エラー: {generated.error}</div>;
  }

  const { seq } = generated;
  const totalBeats = Math.max(1, seq.totalBeats);
  const svgWidth = 720;
  const svgHeight = 112;
  const pitchSpan = Math.max(12, pitchBounds.max - pitchBounds.min);

  return (
    <div className="midi-card">
      <div className="midi-controls">
        {!isPlaying ? (
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => void startPlayback()}
          >
            ピアノ再生
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
            onChange={(e) => {
              const next = Math.max(20, Math.min(350, Number(e.target.value) || defaultBpm));
              setBpm(next);
              if (isPlaying) void startPlayback({ bpm: next });
            }}
            style={{ width: 58, background: 'transparent', border: 'none', textAlign: 'right' }}
          />
        </div>

        <div className="control-group">
          <span>Transpose</span>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              const next = Math.max(-12, transpose - 1);
              setTranspose(next);
              if (isPlaying) void startPlayback({ transpose: next });
            }}
          >
            -1
          </button>
          <span style={{ minWidth: 30, textAlign: 'center', fontFamily: 'var(--mono)' }}>
            {transpose > 0 ? `+${transpose}` : transpose}
          </span>
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              const next = Math.min(12, transpose + 1);
              setTranspose(next);
              if (isPlaying) void startPlayback({ transpose: next });
            }}
          >
            +1
          </button>
        </div>

        <select
          aria-label="ボイシングスタイル"
          className="select"
          value={voicing}
          onChange={(e) => {
            const next = e.target.value as VoicingStyle;
            setVoicing(next);
            if (isPlaying) void startPlayback({ voicing: next });
          }}
          style={{ width: 'auto', padding: '4px 9px', fontSize: '0.82rem' }}
        >
          {VOICING_OPTIONS.map((opt) => (
            <option key={opt.value} value={opt.value}>
              {opt.label}
            </option>
          ))}
        </select>

        <button type="button" className="btn btn-primary btn-sm" onClick={handleDownloadMid}>
          Piano .mid ダウンロード
        </button>

        <button type="button" className="btn btn-sm" onClick={handleCopyQuickLine}>
          コード列コピー
        </button>

        {onSendToLab && (
          <button
            type="button"
            className="btn btn-sm"
            onClick={() => {
              const line = seq.chordSpans.map((s) => `${s.displaySymbol}(${s.beats})`).join(' ');
              onSendToLab(line, bpm, baseKey ?? 'C major');
            }}
          >
            試聴ラボで編集
          </button>
        )}
      </div>

      {/* Live chord timeline */}
      <div className="chord-timeline" role="list" aria-label="コード進行タイムライン">
        {seq.chordSpans.map((span) => {
          const isActive = isPlaying && activeChordIdx === span.index;
          return (
            <div
              key={span.index}
              role="listitem"
              className={`chord-block ${isActive ? 'active' : ''} ${span.isRest ? 'rest' : ''}`}
              style={{ flexGrow: span.beats }}
            >
              {span.roman && <div className="chord-block-roman">{span.roman}</div>}
              <div className="chord-block-symbol">{span.displaySymbol}</div>
              <div className="chord-block-beats">{span.beats}拍</div>
            </div>
          );
        })}
      </div>

      {/* Piano roll visualization */}
      <div className="pianoroll-wrap" style={{ marginTop: 10 }}>
        <svg
          className="pianoroll-svg"
          style={{ height: svgHeight }}
          viewBox={`0 0 ${svgWidth} ${svgHeight}`}
          preserveAspectRatio="none"
          role="img"
          aria-label={`${title} piano roll`}
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

          {seq.notes.map((note, idx) => {
            const x = (note.startBeat / totalBeats) * svgWidth;
            const w = Math.max(4, (note.durationBeats / totalBeats) * svgWidth - 2);
            const normalizedPitch = (note.midi - pitchBounds.min) / pitchSpan;
            const y = svgHeight - 8 - normalizedPitch * (svgHeight - 16);
            const isActiveNote = isPlaying && activeChordIdx === note.chordIndex;
            return (
              <rect
                key={idx}
                x={x}
                y={y}
                width={w}
                height={5}
                rx={1.5}
                fill={isActiveNote ? '#34d399' : '#60a5fa'}
                opacity={isActiveNote ? 1 : 0.78}
              />
            );
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
