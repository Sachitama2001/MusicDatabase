import { useEffect, useMemo, useRef, useState } from 'react';
import { validateMidiClipData, type MidiClip, type Track } from '../../schema';
import { smfToMidiClip } from '../../midi/converter';
import { MidiPlayerCard } from '../components/MidiPlayerCard';

interface MidiStudioViewProps {
  tracks: Track[];
  initialClip: MidiClip | null;
  onNotify: (msg: string) => void;
}

export function extractJsonFromText(raw: string): string {
  const trimmed = raw.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  if (fenced && fenced[1]) {
    return fenced[1].trim();
  }
  return trimmed;
}

export function MidiStudioView({ tracks, initialClip, onNotify }: MidiStudioViewProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  const dbClips = useMemo(() => {
    const items: Array<{ key: string; label: string; clip: MidiClip }> = [];
    for (const track of tracks) {
      for (const sec of track.sections) {
        for (const clip of sec.midiClips ?? []) {
          items.push({
            key: `${track.id}::${sec.id}::${clip.id}`,
            label: `${track.artist} - ${track.title} [${sec.displayName}] / ${clip.name}`,
            clip
          });
        }
      }
    }
    return items;
  }, [tracks]);

  const [beforeClip, setBeforeClip] = useState<MidiClip | null>(
    initialClip ?? dbClips[0]?.clip ?? null
  );
  const [importError, setImportError] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);

  const [afterRawText, setAfterRawText] = useState('');
  const [compareSlot, setCompareSlot] = useState<'before' | 'after'>('before');

  useEffect(() => {
    if (initialClip) {
      setBeforeClip(initialClip);
      setCompareSlot('before');
    }
  }, [initialClip]);

  const afterValidation = useMemo(() => {
    if (!afterRawText.trim()) {
      return { status: 'empty' as const, clip: null, errors: [] as string[] };
    }
    try {
      const cleaned = extractJsonFromText(afterRawText);
      const parsed = JSON.parse(cleaned);
      const result = validateMidiClipData(parsed);
      if (result.success && result.data) {
        return { status: 'valid' as const, clip: result.data, errors: [] as string[] };
      }
      return {
        status: 'invalid' as const,
        clip: null,
        errors: result.issues.map((i) => `${i.path}: ${i.message}`)
      };
    } catch (err) {
      return {
        status: 'invalid' as const,
        clip: null,
        errors: [`JSON構文エラー: ${err instanceof Error ? err.message : String(err)}`]
      };
    }
  }, [afterRawText]);

  async function handleFileLoad(file: File) {
    setImportError(null);
    if (!file.name.toLowerCase().endsWith('.mid') && !file.name.toLowerCase().endsWith('.midi')) {
      setImportError('対応形式はStandard MIDI File (.mid / .midi) のみです。');
      return;
    }
    try {
      const buf = await file.arrayBuffer();
      const clip = smfToMidiClip(buf, file.name);
      setBeforeClip(clip);
      setCompareSlot('before');
      onNotify(`"${file.name}" を読み込みました (${clip.tracks.length} tracks / ${clip.bars} bars)`);
    } catch (err) {
      setImportError(err instanceof Error ? err.message : String(err));
    }
  }

  function handleCopyBeforePrompt() {
    if (!beforeClip) return;
    const prompt = [
      '以下はDAWから読み込んだ変更前の MidiClip JSON です。',
      'リポジトリの LLM_GUIDE.md の MidiClip 仕様に従い、指定されていないトラックのノートは保持したまま、私の指示に沿って微調整した完全な MidiClip JSON を返してください。',
      '',
      '【微調整の指示】',
      '（ここに例: ハーフテンポにして切ないコードボイシングへ変更して、のように記入）',
      '',
      '```json',
      JSON.stringify(beforeClip, null, 2),
      '```'
    ].join('\n');
    void navigator.clipboard.writeText(prompt).then(() => {
      onNotify('ChatGPT用の微調整プロンプト＋MidiClip JSONをコピーしました');
    });
  }

  function handleCopyBeforeJsonOnly() {
    if (!beforeClip) return;
    void navigator.clipboard.writeText(JSON.stringify(beforeClip, null, 2)).then(() => {
      onNotify('BeforeのMidiClip JSONをコピーしました');
    });
  }

  const activeCompareClip =
    compareSlot === 'after' && afterValidation.clip ? afterValidation.clip : beforeClip;

  return (
    <div>
      <section className="panel">
        <div className="card-header">
          <div>
            <h2 className="section-heading" style={{ marginBottom: 4 }}>
              MIDIスタジオ — DAW ⇄ ChatGPT 変換・A/B比較・書き出し
            </h2>
            <p className="muted" style={{ margin: 0 }}>
              .midファイルをドロップしてMidiClip JSON化し、ChatGPTで微調整したJSONを右側へ貼り付けてA/B比較再生と.mid書き出しができます。
            </p>
          </div>
          <div className="chip-row">
            <button
              type="button"
              className={`btn btn-sm ${compareSlot === 'before' ? 'btn-primary' : ''}`}
              disabled={!beforeClip}
              onClick={() => setCompareSlot('before')}
            >
              A: Beforeを試聴
            </button>
            <button
              type="button"
              className={`btn btn-sm ${compareSlot === 'after' ? 'btn-primary' : ''}`}
              disabled={!afterValidation.clip}
              onClick={() => setCompareSlot('after')}
            >
              B: Afterを試聴
            </button>
          </div>
        </div>

        {activeCompareClip ? (
          <MidiPlayerCard
            clip={activeCompareClip}
            label={compareSlot === 'after' && afterValidation.clip ? 'B (After / ChatGPT出力)' : 'A (Before / 入力)'}
            onNotify={onNotify}
          />
        ) : (
          <p className="muted">左側から .mid ファイルまたはDBクリップを読み込んでください。</p>
        )}
      </section>

      <div className="studio-grid">
        <section className="panel">
          <h3 className="section-heading">A. Before / 入力MIDI (.mid → JSON)</h3>

          <div
            className={`dropzone ${dragging ? 'dragging' : ''}`}
            onDragOver={(e) => {
              e.preventDefault();
              setDragging(true);
            }}
            onDragLeave={() => setDragging(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragging(false);
              const file = e.dataTransfer.files?.[0];
              if (file) void handleFileLoad(file);
            }}
            onClick={() => fileInputRef.current?.click()}
            role="button"
            tabIndex={0}
            onKeyDown={(e) => {
              if (e.key === 'Enter' || e.key === ' ') fileInputRef.current?.click();
            }}
          >
            <input
              ref={fileInputRef}
              type="file"
              accept=".mid,.midi"
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) void handleFileLoad(file);
                e.target.value = '';
              }}
            />
            <strong>.mid ファイルをここにドロップ、またはクリックして選択</strong>
            <div className="muted" style={{ marginTop: 4 }}>
              Fender Studio Pro 等から書き出した Standard MIDI File を読み込みます
            </div>
          </div>

          {dbClips.length > 0 && (
            <div style={{ marginTop: 10 }}>
              <label className="field-label" htmlFor="db-clip-select">
                またはDB内の登録済みクリップを読み込む
              </label>
              <select
                id="db-clip-select"
                className="select"
                value=""
                onChange={(e) => {
                  const found = dbClips.find((item) => item.key === e.target.value);
                  if (found) {
                    setBeforeClip(found.clip);
                    setCompareSlot('before');
                    onNotify(`"${found.clip.name}" をBeforeへ読み込みました`);
                  }
                }}
              >
                <option value="">クリップを選択...</option>
                {dbClips.map((item) => (
                  <option key={item.key} value={item.key}>
                    {item.label}
                  </option>
                ))}
              </select>
            </div>
          )}

          {importError && <div className="status-banner status-error">{importError}</div>}

          {beforeClip && (
            <>
              <div className="action-row">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={handleCopyBeforePrompt}
                >
                  ChatGPT微調整プロンプト付きでコピー
                </button>
                <button type="button" className="btn btn-sm" onClick={handleCopyBeforeJsonOnly}>
                  JSONのみコピー
                </button>
              </div>
              <textarea
                className="textarea"
                readOnly
                rows={14}
                style={{ marginTop: 10 }}
                value={JSON.stringify(beforeClip, null, 2)}
                aria-label="Before MidiClip JSON"
              />
            </>
          )}
        </section>

        <section className="panel">
          <h3 className="section-heading">B. After / ChatGPT出力MIDI (JSON → .mid)</h3>
          <p className="muted" style={{ marginTop: 0 }}>
            ChatGPTが出力した MidiClip JSON（```json コードブロックのまま可）を貼り付けると自動検証し、上のプレイヤーでA/B比較および .mid 書き出しができます。
          </p>

          <textarea
            className="textarea"
            rows={15}
            placeholder='{"id": "clip-modified", "name": "...", "bpm": 144, "timeSignature": "4/4", "bars": 4, "tracks": [...]}'
            value={afterRawText}
            onChange={(e) => setAfterRawText(e.target.value)}
            aria-label="After MidiClip JSON"
          />

          <div className="action-row">
            <button
              type="button"
              className="btn btn-sm"
              disabled={!beforeClip}
              onClick={() => {
                if (beforeClip) {
                  setAfterRawText(JSON.stringify(beforeClip, null, 2));
                }
              }}
            >
              BeforeのJSONをコピーして編集開始
            </button>
            <button
              type="button"
              className="btn btn-sm"
              disabled={!afterRawText}
              onClick={() => setAfterRawText('')}
            >
              クリア
            </button>
          </div>

          {afterValidation.status === 'valid' && afterValidation.clip && (
            <div className="status-banner status-ok">
              検証OK: {afterValidation.clip.name} ({afterValidation.clip.tracks.length} tracks /{' '}
              {afterValidation.clip.bars} bars / {afterValidation.clip.bpm} BPM)
              <div style={{ marginTop: 8 }}>
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => setCompareSlot('after')}
                >
                  上のプレイヤーで B (After) を試聴・書き出し
                </button>
              </div>
            </div>
          )}

          {afterValidation.status === 'invalid' && (
            <div className="status-banner status-error">
              <strong>スキーマ検証エラー:</strong>
              <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
                {afterValidation.errors.map((err, i) => (
                  <li key={i}>{err}</li>
                ))}
              </ul>
            </div>
          )}
        </section>
      </div>
    </div>
  );
}
