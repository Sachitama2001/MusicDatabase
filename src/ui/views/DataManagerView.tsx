import { useEffect, useMemo, useState } from 'react';
import { validateTrackData, type DatabaseIndex } from '../../schema';
import { extractJsonFromText } from './MidiStudioView';

interface DataManagerViewProps {
  db: DatabaseIndex;
  onNotify: (msg: string) => void;
}

export function DataManagerView({ db, onNotify }: DataManagerViewProps) {
  const [rawTrackJson, setRawTrackJson] = useState('');
  const [llmGuideText, setLlmGuideText] = useState<string>('');
  const [guideError, setGuideError] = useState<string | null>(null);

  useEffect(() => {
    fetch('./LLM_GUIDE.md')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.text();
      })
      .then((text) => setLlmGuideText(text))
      .catch(() => setGuideError('LLM_GUIDE.md の読み込みに失敗しました。リポジトリルートの LLM_GUIDE.md を直接参照してください。'));
  }, []);

  const midiClipCount = useMemo(() => {
    let count = 0;
    for (const t of db.tracks) {
      for (const s of t.sections) {
        count += s.midiClips?.length ?? 0;
      }
    }
    return count;
  }, [db]);

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
            <div className="muted">分析セクション数</div>
            <div className="stat-value">{db.sectionCount}</div>
          </div>
          <div className="stat-box">
            <div className="muted">MIDIクリップ数</div>
            <div className="stat-value">{midiClipCount}</div>
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
        <h2 className="section-heading">Track JSON スキーマ検証ツール</h2>
        <p className="muted" style={{ marginTop: 0 }}>
          ChatGPTが作成した <code>data/tracks/&lt;track-id&gt;.json</code> の内容を貼り付けて、コミット前にスキーマと不変条件を確認できます。
        </p>

        <textarea
          className="textarea"
          rows={12}
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
              新しいChatGPTスレッドでGitHub接続して作業させるとき、そのまま参照または貼り付けできます。
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
