import { useEffect, useMemo, useState } from 'react';
import { validateTrackData, type DatabaseIndex } from '../../schema';
import { parseQuickChordLine } from '../../midi/chordEngine';
import { ChordMidiPlayer } from '../components/ChordMidiPlayer';

interface ChordLabAndDataViewProps {
  db: DatabaseIndex;
  initialLabLine: string | null;
  initialLabBpm: number;
  initialLabKey: string;
  onNotify: (msg: string) => void;
}

const PRESETS = [
  {
    label: '丸サ進行 (IVM7 III7 VIm7 Vm7 I7)',
    line: 'FM7(2) E7(2) Am7(2) Gm7(1) C7(1)',
    bpm: 120,
    key: 'C major'
  },
  {
    label: '王道進行 (IV V IIIm VIm)',
    line: 'F(4) G(4) Em(4) Am(4)',
    bpm: 128,
    key: 'C major'
  },
  {
    label: '小室進行 (VIm IV V I)',
    line: 'Am(4) F(4) G(4) C(4)',
    bpm: 132,
    key: 'C major'
  },
  {
    label: 'カノン進行 (I V/VII VIm IIIm/V IV I/III IV V)',
    line: 'C(2) G/B(2) Am(2) Em/G(2) F(2) C/E(2) F(2) G(2)',
    bpm: 108,
    key: 'C major'
  }
];

function extractJsonFromText(raw: string): string {
  const trimmed = raw.trim();
  const fenced = /```(?:json)?\s*([\s\S]*?)```/i.exec(trimmed);
  if (fenced && fenced[1]) return fenced[1].trim();
  return trimmed;
}

export function ChordLabAndDataView({
  db,
  initialLabLine,
  initialLabBpm,
  initialLabKey,
  onNotify
}: ChordLabAndDataViewProps) {
  const [labLine, setLabLine] = useState(initialLabLine ?? PRESETS[0].line);
  const [labBpm, setLabBpm] = useState(initialLabBpm);
  const [labKey, setLabKey] = useState(initialLabKey);

  const [rawTrackJson, setRawTrackJson] = useState('');
  const [llmGuideText, setLlmGuideText] = useState('');
  const [guideError, setGuideError] = useState<string | null>(null);

  useEffect(() => {
    if (initialLabLine) {
      setLabLine(initialLabLine);
      setLabBpm(initialLabBpm);
      setLabKey(initialLabKey);
    }
  }, [initialLabLine, initialLabBpm, initialLabKey]);

  useEffect(() => {
    fetch('./LLM_GUIDE.md')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((text) => setLlmGuideText(text))
      .catch(() =>
        setGuideError(
          'LLM_GUIDE.md の読み込みに失敗しました。リポジトリルートの LLM_GUIDE.md を直接参照してください。'
        )
      );
  }, []);

  const parsedLab = useMemo(() => {
    if (!labLine.trim()) return { ok: false as const, error: 'コード進行を入力してください。' };
    try {
      const chords = parseQuickChordLine(labLine, labKey);
      if (chords.length === 0) {
        return { ok: false as const, error: '有効なコードが入力されていません。' };
      }
      return { ok: true as const, chords };
    } catch (err) {
      return {
        ok: false as const,
        error: err instanceof Error ? err.message : String(err)
      };
    }
  }, [labLine, labKey]);

  const trackValidation = useMemo(() => {
    if (!rawTrackJson.trim()) {
      return { status: 'empty' as const, track: null, errors: [] as string[] };
    }
    try {
      const cleaned = extractJsonFromText(rawTrackJson);
      const parsed = JSON.parse(cleaned);
      const result = validateTrackData(parsed);
      if (result.success && result.data) {
        return { status: 'valid' as const, track: result.data, errors: [] as string[] };
      }
      return {
        status: 'invalid' as const,
        track: null,
        errors: result.issues.map((i) => `${i.path}: ${i.message}`)
      };
    } catch (err) {
      return {
        status: 'invalid' as const,
        track: null,
        errors: [`JSON構文エラー: ${err instanceof Error ? err.message : String(err)}`]
      };
    }
  }, [rawTrackJson]);

  function downloadJson(filename: string, obj: unknown) {
    const blob = new Blob([JSON.stringify(obj, null, 2) + '\n'], {
      type: 'application/json;charset=utf-8'
    });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  return (
    <div>
      <section className="panel">
        <h2 className="section-heading">クイックコード試聴ラボ (コード記号 / 度数 → Piano .mid)</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          ChatGPTが提案したコード進行やChordTubeの度数進行（例: <code>FM7(2) E7(2) Am7(2) Gm7(1) C7(1)</code> や <code>IVM7(2) III7(2) VIm7(2) Vm7(1) I7(1)</code>）を貼り付けると即座にピアノ試聴と <code>.mid</code> 書き出しができます。拍数を省略すると4拍になります。
        </p>

        <div className="chip-row" style={{ marginBottom: 10 }}>
          {PRESETS.map((p) => (
            <button
              key={p.label}
              type="button"
              className="chip chip-button"
              onClick={() => {
                setLabLine(p.line);
                setLabBpm(p.bpm);
                setLabKey(p.key);
              }}
            >
              {p.label}
            </button>
          ))}
        </div>

        <div className="filter-grid" style={{ marginTop: 0, marginBottom: 10 }}>
          <div style={{ gridColumn: 'span 2' }}>
            <label className="field-label" htmlFor="lab-line-input">
              コード列または度数列
            </label>
            <input
              id="lab-line-input"
              className="input"
              style={{ fontFamily: 'var(--mono)' }}
              value={labLine}
              onChange={(e) => setLabLine(e.target.value)}
              placeholder="FM7(2) E7(2) Am7(2) Gm7(1) C7(1)"
            />
          </div>
          <div>
            <label className="field-label" htmlFor="lab-key-input">
              基準Key (度数入力時に使用)
            </label>
            <input
              id="lab-key-input"
              className="input"
              value={labKey}
              onChange={(e) => setLabKey(e.target.value)}
            />
          </div>
          <div>
            <label className="field-label" htmlFor="lab-bpm-input">
              基準BPM
            </label>
            <input
              id="lab-bpm-input"
              type="number"
              className="input"
              min={20}
              max={350}
              value={labBpm}
              onChange={(e) => setLabBpm(Number(e.target.value) || 120)}
            />
          </div>
        </div>

        {parsedLab.ok ? (
          <ChordMidiPlayer
            title="chord-lab-progression"
            chords={parsedLab.chords}
            defaultBpm={labBpm}
            baseKey={labKey}
            onNotify={onNotify}
          />
        ) : (
          <div className="status-banner status-error">{parsedLab.error}</div>
        )}
      </section>

      <section className="panel">
        <div className="card-header">
          <h2 className="section-heading" style={{ marginBottom: 0 }}>
            データベース統計とエクスポート
          </h2>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            onClick={() => {
              downloadJson('music-database-export.json', db);
              onNotify('全件JSONバンドルをダウンロードしました');
            }}
          >
            全件JSONをエクスポート
          </button>
        </div>

        <div className="stat-grid" style={{ marginTop: 12 }}>
          <div className="stat-box">
            <div className="muted">登録楽曲数</div>
            <div className="stat-value">{db.trackCount}</div>
          </div>
          <div className="stat-box">
            <div className="muted">コード進行セクション数</div>
            <div className="stat-value">{db.sectionCount}</div>
          </div>
          <div className="stat-box">
            <div className="muted">フィーリング語彙数</div>
            <div className="stat-value">{db.feelings.entries.length}</div>
          </div>
        </div>
        <p className="muted" style={{ marginBottom: 0, marginTop: 10 }}>
          Index生成日時: {db.generatedAt} / Schema Version: {db.schemaVersion}
        </p>
      </section>

      <section className="panel">
        <h2 className="section-heading">Track JSON (v2.0) スキーマ検証ツール</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          ChatGPTが作成した <code>data/tracks/&lt;track-id&gt;.json</code> を貼り付けて、<code>chordtube.net</code> URL制約および全コード記号のパース可能性を検証できます。
        </p>

        <textarea
          className="textarea"
          rows={10}
          placeholder="Track JSON（```json コードブロック可）をここへ貼り付け..."
          value={rawTrackJson}
          onChange={(e) => setRawTrackJson(e.target.value)}
          aria-label="Track JSON 検証入力"
        />

        {trackValidation.status === 'valid' && trackValidation.track && (
          <div className="status-banner status-ok">
            検証OK: <code>data/tracks/{trackValidation.track.id}.json</code> (
            {trackValidation.track.artist} - {trackValidation.track.title} /{' '}
            {trackValidation.track.sections.length} section)
            <div style={{ marginTop: 8 }}>
              <button
                type="button"
                className="btn btn-primary btn-sm"
                onClick={() => {
                  downloadJson(`${trackValidation.track!.id}.json`, trackValidation.track);
                  onNotify(`${trackValidation.track!.id}.json をダウンロードしました`);
                }}
              >
                {trackValidation.track.id}.json をダウンロード
              </button>
            </div>
          </div>
        )}

        {trackValidation.status === 'invalid' && (
          <div className="status-banner status-error">
            <strong>スキーマ検証エラー:</strong>
            <ul style={{ margin: '6px 0 0', paddingLeft: 18 }}>
              {trackValidation.errors.map((err, i) => (
                <li key={i}>{err}</li>
              ))}
            </ul>
          </div>
        )}
      </section>

      <section className="panel">
        <div className="card-header">
          <div>
            <h2 className="section-heading" style={{ marginBottom: 4 }}>
              LLM_GUIDE.md — ChatGPT向け1枚完結仕様書
            </h2>
            <p className="muted" style={{ margin: 0 }}>
              新しいChatGPTスレッドでChordTube検索とリポジトリ登録を依頼するときに参照・貼り付けできます。
            </p>
          </div>
          <button
            type="button"
            className="btn btn-primary btn-sm"
            disabled={!llmGuideText}
            onClick={() => {
              void navigator.clipboard.writeText(llmGuideText).then(() => {
                onNotify('LLM_GUIDE.md 全文をクリップボードへコピーしました');
              });
            }}
          >
            LLM_GUIDE.md 全文コピー
          </button>
        </div>

        {guideError ? (
          <div className="status-banner status-error">{guideError}</div>
        ) : (
          <pre className="code-viewer">{llmGuideText || '読み込み中...'}</pre>
        )}
      </section>
    </div>
  );
}
