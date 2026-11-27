import { useCallback, useEffect, useMemo, useState } from 'react';
import { DatabaseIndexSchema, type DatabaseIndex } from './schema';
import { ChordSearchEngine } from './search/engine';
import { pianoPlayer } from './midi/player';
import { SearchView } from './ui/views/SearchView';
import { TrackDetailView } from './ui/views/TrackDetailView';
import { ChordLabAndDataView } from './ui/views/ChordLabAndDataView';

type TabId = 'search' | 'detail' | 'lab';

export function App() {
  const [activeTab, setActiveTab] = useState<TabId>('search');
  const [db, setDb] = useState<DatabaseIndex | null>(null);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [selectedTrackId, setSelectedTrackId] = useState<string | null>(null);
  const [highlightSectionId, setHighlightSectionId] = useState<string | null>(null);

  const [labLine, setLabLine] = useState<string | null>(null);
  const [labBpm, setLabBpm] = useState<number>(120);
  const [labKey, setLabKey] = useState<string>('C major');

  const [toast, setToast] = useState<string | null>(null);

  const showToast = useCallback((message: string) => {
    setToast(message);
  }, []);

  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 2800);
    return () => window.clearTimeout(timer);
  }, [toast]);

  useEffect(() => {
    let cancelled = false;
    fetch('./data/index.json')
      .then((res) => {
        if (!res.ok) throw new Error(`HTTP ${res.status}`);
        return res.json();
      })
      .then((raw) => {
        if (cancelled) return;
        const parsed = DatabaseIndexSchema.parse(raw);
        setDb(parsed);
        if (parsed.tracks.length > 0) {
          setSelectedTrackId(parsed.tracks[0].id);
        }
      })
      .catch((err) => {
        if (cancelled) return;
        setLoadError(
          `データベースの読み込みに失敗しました: ${err instanceof Error ? err.message : String(err)}`
        );
      });
    return () => {
      cancelled = true;
    };
  }, []);

  const searchEngine = useMemo(() => {
    if (!db) return null;
    return new ChordSearchEngine(db.tracks, db.feelings);
  }, [db]);

  function handleTabChange(next: TabId) {
    pianoPlayer.stop();
    setActiveTab(next);
  }

  function handleSelectTrackFromSearch(trackId: string, sectionId?: string) {
    pianoPlayer.stop();
    setSelectedTrackId(trackId);
    setHighlightSectionId(sectionId ?? null);
    setActiveTab('detail');
  }

  function handleSendToLab(quickLine: string, bpm: number, key: string) {
    pianoPlayer.stop();
    setLabLine(quickLine);
    setLabBpm(bpm);
    setLabKey(key);
    setActiveTab('lab');
  }

  return (
    <div className="app-shell">
      <header className="topbar">
        <div className="brand">
          <h1 className="brand-title">MusicDatabase</h1>
          <span className="brand-sub">
            {db
              ? `ChordTube DB — ${db.trackCount} tracks / ${db.sectionCount} chord sections`
              : 'Loading database...'}
          </span>
        </div>

        <nav className="nav-tabs" aria-label="メインナビゲーション">
          <button
            type="button"
            className={`nav-tab ${activeTab === 'search' ? 'active' : ''}`}
            onClick={() => handleTabChange('search')}
          >
            検索・発見
          </button>
          <button
            type="button"
            className={`nav-tab ${activeTab === 'detail' ? 'active' : ''}`}
            onClick={() => handleTabChange('detail')}
          >
            楽曲詳細・MIDI試聴
          </button>
          <button
            type="button"
            className={`nav-tab ${activeTab === 'lab' ? 'active' : ''}`}
            onClick={() => handleTabChange('lab')}
          >
            コード試聴ラボ・検証・LLMガイド
          </button>
        </nav>
      </header>

      <main className="main-container">
        {loadError && <div className="status-banner status-error">{loadError}</div>}

        {!loadError && !db && (
          <section className="panel">
            <p className="muted" style={{ margin: 0 }}>
              コード進行データベースを読み込んでいます...
            </p>
          </section>
        )}

        {db && searchEngine && activeTab === 'search' && (
          <SearchView
            engine={searchEngine}
            onSelectTrack={handleSelectTrackFromSearch}
            onSendToLab={handleSendToLab}
            onNotify={showToast}
          />
        )}

        {db && activeTab === 'detail' && (
          <TrackDetailView
            tracks={db.tracks}
            selectedTrackId={selectedTrackId}
            highlightSectionId={highlightSectionId}
            onSelectTrack={(id) => {
              setSelectedTrackId(id);
              setHighlightSectionId(null);
            }}
            onSendToLab={handleSendToLab}
            onNotify={showToast}
          />
        )}

        {db && activeTab === 'lab' && (
          <ChordLabAndDataView
            db={db}
            initialLabLine={labLine}
            initialLabBpm={labBpm}
            initialLabKey={labKey}
            onNotify={showToast}
          />
        )}
      </main>

      {toast && (
        <div className="toast" role="status" aria-live="polite">
          {toast}
        </div>
      )}
    </div>
  );
}
