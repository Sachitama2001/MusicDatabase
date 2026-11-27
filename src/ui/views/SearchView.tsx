import { useEffect, useMemo, useRef, useState } from 'react';
import type { SectionLabel, Track } from '../../schema';
import {
  ChordSearchEngine,
  formatChordsAsQuickLine,
  formatSectionForChatGpt,
  type SortOption
} from '../../search/engine';
import { ChordMidiPlayer } from '../components/ChordMidiPlayer';

interface SearchViewProps {
  engine: ChordSearchEngine;
  onSelectTrack: (trackId: string, sectionId?: string) => void;
  onSendToLab: (quickLine: string, bpm: number, key: string) => void;
  onNotify: (msg: string) => void;
}

const SECTION_LABELS: SectionLabel[] = [
  'intro',
  'verse',
  'pre_chorus',
  'chorus',
  'bridge',
  'drop',
  'interlude',
  'outro',
  'other'
];

export function SearchView({
  engine,
  onSelectTrack,
  onSendToLab,
  onNotify
}: SearchViewProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [romanQuery, setRomanQuery] = useState('');
  const [chordQuery, setChordQuery] = useState('');
  const [keyQuery, setKeyQuery] = useState('');
  const [bpmMin, setBpmMin] = useState('');
  const [bpmMax, setBpmMax] = useState('');
  const [sectionLabel, setSectionLabel] = useState<SectionLabel | ''>('');
  const [selectedFeelings, setSelectedFeelings] = useState<string[]>([]);
  const [feelingTagMode, setFeelingTagMode] = useState<'AND' | 'OR'>('OR');
  const [sort, setSort] = useState<SortOption>('relevance');
  const [expandedPlayerUid, setExpandedPlayerUid] = useState<string | null>(null);

  const allFeelingTags = useMemo(() => engine.getAllFeelingTags(), [engine]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isEditing =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT');
      if (e.key === '/' && !isEditing) {
        e.preventDefault();
        searchInputRef.current?.focus();
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, []);

  const hits = useMemo(() => {
    return engine.search({
      query,
      romanQuery,
      chordQuery,
      keyQuery,
      bpmMin: bpmMin.trim() ? Number(bpmMin) : undefined,
      bpmMax: bpmMax.trim() ? Number(bpmMax) : undefined,
      sectionLabels: sectionLabel ? [sectionLabel] : undefined,
      feelingTags: selectedFeelings,
      feelingTagMode,
      sort
    });
  }, [
    engine,
    query,
    romanQuery,
    chordQuery,
    keyQuery,
    bpmMin,
    bpmMax,
    sectionLabel,
    selectedFeelings,
    feelingTagMode,
    sort
  ]);

  function toggleFeelingTag(tag: string) {
    setSelectedFeelings((prev) =>
      prev.includes(tag) ? prev.filter((t) => t !== tag) : [...prev, tag]
    );
  }

  function resetAllFilters() {
    setQuery('');
    setRomanQuery('');
    setChordQuery('');
    setKeyQuery('');
    setBpmMin('');
    setBpmMax('');
    setSectionLabel('');
    setSelectedFeelings([]);
    setSort('relevance');
  }

  function handleCopyForChatGpt(track: Track, sectionId: string) {
    const section = track.sections.find((s) => s.id === sectionId);
    if (!section) return;
    void navigator.clipboard.writeText(formatSectionForChatGpt(track, section)).then(() => {
      onNotify('ChatGPTへ渡す参照コード進行要約をコピーしました');
    });
  }

  return (
    <div>
      <section className="panel">
        <h2 className="section-heading">フィーリング・コード進行検索 (ChordTube DB)</h2>
        <div className="search-bar-row">
          <input
            ref={searchInputRef}
            type="search"
            className="input"
            placeholder="雰囲気・感情・曲名を入力 (例: 切ない / 泣ける / おしゃれ / 浮遊感)  [ / キーでフォーカス ]"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="フィーリング検索"
          />
          <button type="button" className="btn" onClick={resetAllFilters}>
            条件クリア
          </button>
        </div>

        <div className="filter-grid">
          <div>
            <label className="field-label" htmlFor="roman-filter">
              度数進行の連続一致
            </label>
            <input
              id="roman-filter"
              className="input"
              placeholder="例: IVM7 III7 VIm7"
              value={romanQuery}
              onChange={(e) => setRomanQuery(e.target.value)}
            />
          </div>

          <div>
            <label className="field-label" htmlFor="chord-filter">
              実音コードの連続一致
            </label>
            <input
              id="chord-filter"
              className="input"
              placeholder="例: FM7 E7 Am7"
              value={chordQuery}
              onChange={(e) => setChordQuery(e.target.value)}
            />
          </div>

          <div>
            <label className="field-label" htmlFor="key-filter">
              Key
            </label>
            <input
              id="key-filter"
              className="input"
              placeholder="例: C major / G# minor"
              value={keyQuery}
              onChange={(e) => setKeyQuery(e.target.value)}
            />
          </div>

          <div>
            <label className="field-label" htmlFor="section-label-filter">
              セクション区分
            </label>
            <select
              id="section-label-filter"
              className="select"
              value={sectionLabel}
              onChange={(e) => setSectionLabel(e.target.value as SectionLabel | '')}
            >
              <option value="">すべて</option>
              {SECTION_LABELS.map((lbl) => (
                <option key={lbl} value={lbl}>
                  {lbl}
                </option>
              ))}
            </select>
          </div>

          <div>
            <label className="field-label">BPM範囲</label>
            <div style={{ display: 'flex', gap: 6 }}>
              <input
                type="number"
                className="input"
                placeholder="Min"
                aria-label="最小BPM"
                value={bpmMin}
                onChange={(e) => setBpmMin(e.target.value)}
              />
              <input
                type="number"
                className="input"
                placeholder="Max"
                aria-label="最大BPM"
                value={bpmMax}
                onChange={(e) => setBpmMax(e.target.value)}
              />
            </div>
          </div>

          <div>
            <label className="field-label" htmlFor="sort-select">
              並び順
            </label>
            <select
              id="sort-select"
              className="select"
              value={sort}
              onChange={(e) => setSort(e.target.value as SortOption)}
            >
              <option value="relevance">関連度順</option>
              <option value="newest">更新が新しい順</option>
              <option value="ratingDesc">評価が高い順</option>
              <option value="bpmAsc">BPM昇順</option>
              <option value="bpmDesc">BPM降順</option>
            </select>
          </div>
        </div>

        {allFeelingTags.length > 0 && (
          <div style={{ marginTop: 12 }}>
            <div className="chip-row" style={{ marginBottom: 6 }}>
              <span className="field-label" style={{ marginBottom: 0 }}>
                登録済みフィーリングタグ
              </span>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => setFeelingTagMode((m) => (m === 'OR' ? 'AND' : 'OR'))}
              >
                複数選択: {feelingTagMode}
              </button>
            </div>
            <div className="chip-row">
              {allFeelingTags.map((tag) => (
                <button
                  key={tag}
                  type="button"
                  className={`chip chip-button chip-feeling ${
                    selectedFeelings.includes(tag) ? 'selected' : ''
                  }`}
                  onClick={() => toggleFeelingTag(tag)}
                >
                  {tag}
                </button>
              ))}
            </div>
          </div>
        )}
      </section>

      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginTop: 16
        }}
      >
        <span className="muted">
          検索結果: <strong>{hits.length}</strong> セクション
        </span>
      </div>

      {hits.length === 0 ? (
        <section className="panel" style={{ marginTop: 12 }}>
          <p style={{ marginTop: 0 }}>
            条件に一致するコード進行が見つかりませんでした。条件を緩和するか、以下の登録済みフィーリングタグから探してください。
          </p>
          <div className="chip-row" style={{ marginBottom: 12 }}>
            {allFeelingTags.map((tag) => (
              <button
                key={tag}
                type="button"
                className="chip chip-button chip-feeling"
                onClick={() => {
                  resetAllFilters();
                  setSelectedFeelings([tag]);
                }}
              >
                {tag}
              </button>
            ))}
          </div>
          <button type="button" className="btn btn-primary" onClick={resetAllFilters}>
            すべての条件をリセット
          </button>
        </section>
      ) : (
        <div className="card-list">
          {hits.map(({ record }) => {
            const { track, section } = record;
            const isPlayerOpen = expandedPlayerUid === record.uid;

            return (
              <article className="result-card" key={record.uid}>
                <div className="card-header">
                  <div>
                    <h3 className="card-title">
                      {track.artist} — {track.title}{' '}
                      <span className="chip">{section.displayName}</span>
                      {track.source.isSample && (
                        <span className="chip" style={{ marginLeft: 6 }}>
                          Sample
                        </span>
                      )}
                    </h3>
                    <div className="meta-inline" style={{ marginTop: 4 }}>
                      <span>BPM: {record.effectiveBpm}</span>
                      <span>Key: {record.effectiveKey}</span>
                      <span>Time: {record.effectiveTimeSignature}</span>
                      {section.rating && <span>Rating: {'★'.repeat(section.rating)}</span>}
                      <a
                        href={track.source.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--accent)' }}
                      >
                        ChordTube ↗
                      </a>
                    </div>
                  </div>
                  <div className="chip-row">
                    {section.feelings.map((f) => (
                      <span key={f} className="chip chip-feeling">
                        {f}
                      </span>
                    ))}
                  </div>
                </div>

                <div className="summary-quote">{section.feelingSummary}</div>

                <div className="element-box" style={{ marginTop: 10 }}>
                  <h4>Chord Progression / コード進行</h4>
                  <div className="chip-row" style={{ marginBottom: 6 }}>
                    {section.chords.map((c, idx) => (
                      <span key={`${c.roman}-${idx}`} className="chip chip-roman">
                        {c.roman}
                      </span>
                    ))}
                  </div>
                  <div className="chip-row" style={{ marginBottom: 6 }}>
                    {section.chords.map((c, idx) => (
                      <span key={`${c.symbol}-${idx}`} className="chip chip-chord">
                        {c.symbol} ({c.beats}拍)
                      </span>
                    ))}
                  </div>
                  {section.cadenceOrMotion && (
                    <p style={{ margin: 0 }}>{section.cadenceOrMotion}</p>
                  )}
                </div>

                <div className="action-row">
                  <button
                    type="button"
                    className={`btn btn-sm ${isPlayerOpen ? 'btn-active' : 'btn-primary'}`}
                    onClick={() =>
                      setExpandedPlayerUid((prev) => (prev === record.uid ? null : record.uid))
                    }
                  >
                    {isPlayerOpen ? 'ピアノ試聴を閉じる' : 'その場でピアノ試聴 / .mid書き出し'}
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => onSelectTrack(track.id, section.id)}
                  >
                    楽曲詳細を開く
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() =>
                      onSendToLab(
                        formatChordsAsQuickLine(section.chords),
                        record.effectiveBpm,
                        record.effectiveKey
                      )
                    }
                  >
                    試聴ラボでアレンジ
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => handleCopyForChatGpt(track, section.id)}
                  >
                    ChatGPT用要約コピー
                  </button>
                </div>

                {isPlayerOpen && (
                  <ChordMidiPlayer
                    title={`${track.artist}-${track.title}-${section.displayName}`}
                    chords={section.chords}
                    defaultBpm={record.effectiveBpm}
                    baseKey={record.effectiveKey}
                    timeSignature={record.effectiveTimeSignature}
                    onNotify={onNotify}
                    onSendToLab={onSendToLab}
                  />
                )}
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
