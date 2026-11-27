import { useEffect, useMemo, useRef, useState } from 'react';
import type { MidiClip, RhythmFeel, SectionLabel, Track } from '../../schema';
import {
  formatSectionForChatGpt,
  MusicSearchEngine,
  type ElementFilter,
  type SortOption
} from '../../search/engine';

interface SearchViewProps {
  engine: MusicSearchEngine;
  onSelectTrack: (trackId: string, sectionId?: string) => void;
  onOpenClipInStudio: (clip: MidiClip) => void;
  onNotify: (msg: string) => void;
}

const SECTION_LABELS: SectionLabel[] = [
  'intro',
  'verse',
  'pre_chorus',
  'chorus',
  'bridge',
  'drop',
  'solo',
  'interlude',
  'outro',
  'other'
];

const RHYTHM_FEELS: RhythmFeel[] = [
  'straight',
  'half-time',
  'double-time',
  'shuffle',
  'swing',
  'syncopated',
  'polyrhythm',
  'other'
];

export function SearchView({
  engine,
  onSelectTrack,
  onOpenClipInStudio,
  onNotify
}: SearchViewProps) {
  const searchInputRef = useRef<HTMLInputElement>(null);

  const [query, setQuery] = useState('');
  const [romanQuery, setRomanQuery] = useState('');
  const [keyQuery, setKeyQuery] = useState('');
  const [bpmMin, setBpmMin] = useState('');
  const [bpmMax, setBpmMax] = useState('');
  const [elementFilter, setElementFilter] = useState<ElementFilter>('all');
  const [sectionLabel, setSectionLabel] = useState<SectionLabel | ''>('');
  const [rhythmFeel, setRhythmFeel] = useState<RhythmFeel | ''>('');
  const [selectedFeelings, setSelectedFeelings] = useState<string[]>([]);
  const [feelingTagMode, setFeelingTagMode] = useState<'AND' | 'OR'>('OR');
  const [sort, setSort] = useState<SortOption>('relevance');

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
      keyQuery,
      bpmMin: bpmMin.trim() ? Number(bpmMin) : undefined,
      bpmMax: bpmMax.trim() ? Number(bpmMax) : undefined,
      sectionLabels: sectionLabel ? [sectionLabel] : undefined,
      rhythmFeels: rhythmFeel ? [rhythmFeel] : undefined,
      elementFilter,
      feelingTags: selectedFeelings,
      feelingTagMode,
      sort
    });
  }, [
    engine,
    query,
    romanQuery,
    keyQuery,
    bpmMin,
    bpmMax,
    sectionLabel,
    rhythmFeel,
    elementFilter,
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
    setKeyQuery('');
    setBpmMin('');
    setBpmMax('');
    setElementFilter('all');
    setSectionLabel('');
    setRhythmFeel('');
    setSelectedFeelings([]);
    setSort('relevance');
  }

  function handleCopyForChatGpt(track: Track, sectionId: string) {
    const section = track.sections.find((s) => s.id === sectionId);
    if (!section) return;
    const text = formatSectionForChatGpt(track, section);
    void navigator.clipboard.writeText(text).then(() => {
      onNotify('ChatGPTへ渡す参照セクション要約をコピーしました');
    });
  }

  return (
    <div>
      <section className="panel">
        <h2 className="section-heading">フィーリング・構成要素検索</h2>
        <div className="search-bar-row">
          <input
            ref={searchInputRef}
            type="search"
            className="input"
            placeholder="雰囲気・感情・技法を入力 (例: 切ない ハーフテンポ / 泣ける / 不安定からの着地)  [ / キーでフォーカス ]"
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
              placeholder="例: bVImaj9 v7"
              value={romanQuery}
              onChange={(e) => setRomanQuery(e.target.value)}
            />
          </div>

          <div>
            <label className="field-label" htmlFor="key-filter">
              Key
            </label>
            <input
              id="key-filter"
              className="input"
              placeholder="例: F# minor / Dorian"
              value={keyQuery}
              onChange={(e) => setKeyQuery(e.target.value)}
            />
          </div>

          <div>
            <label className="field-label" htmlFor="element-filter">
              要素フィルタ
            </label>
            <select
              id="element-filter"
              className="select"
              value={elementFilter}
              onChange={(e) => setElementFilter(e.target.value as ElementFilter)}
            >
              <option value="all">すべて</option>
              <option value="rhythm">リズム分析あり</option>
              <option value="melody">メロディー分析あり</option>
              <option value="harmony">コード分析あり</option>
              <option value="hasMidi">MIDIクリップ付き</option>
            </select>
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
            <label className="field-label" htmlFor="rhythm-feel-filter">
              リズムフィール
            </label>
            <select
              id="rhythm-feel-filter"
              className="select"
              value={rhythmFeel}
              onChange={(e) => setRhythmFeel(e.target.value as RhythmFeel | '')}
            >
              <option value="">すべて</option>
              {RHYTHM_FEELS.map((feel) => (
                <option key={feel} value={feel}>
                  {feel}
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
            条件に一致するセクションが見つかりませんでした。条件を緩和するか、以下の登録済みフィーリングタグから探してください。
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
            return (
              <article className="result-card" key={record.uid}>
                <div className="card-header">
                  <div>
                    <h3 className="card-title">
                      {track.artist} — {track.title}{' '}
                      <span className="chip">{section.displayName}</span>
                    </h3>
                    <div className="meta-inline" style={{ marginTop: 4 }}>
                      <span>BPM: {record.effectiveBpm ?? '-'}</span>
                      <span>Key: {record.effectiveKey ?? '-'}</span>
                      <span>Time: {record.effectiveTimeSignature ?? '-'}</span>
                      {section.rating && <span>Rating: {'★'.repeat(section.rating)}</span>}
                      {section.midiClips && section.midiClips.length > 0 && (
                        <span>MIDI: {section.midiClips.length} clip</span>
                      )}
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

                <div className="elements-grid">
                  {section.harmony && (
                    <div className="element-box">
                      <h4>Harmony / コード</h4>
                      {section.harmony.romanNumerals && section.harmony.romanNumerals.length > 0 && (
                        <div className="chip-row" style={{ marginBottom: 6 }}>
                          {section.harmony.romanNumerals.map((r, idx) => (
                            <span key={`${r}-${idx}`} className="chip chip-roman">
                              {r}
                            </span>
                          ))}
                        </div>
                      )}
                      {section.harmony.chordProgression &&
                        section.harmony.chordProgression.length > 0 && (
                          <div className="chip-row" style={{ marginBottom: 6 }}>
                            {section.harmony.chordProgression.map((c, idx) => (
                              <span key={`${c}-${idx}`} className="chip chip-chord">
                                {c}
                              </span>
                            ))}
                          </div>
                        )}
                      {section.harmony.cadenceOrMotion && (
                        <p style={{ margin: 0 }}>{section.harmony.cadenceOrMotion}</p>
                      )}
                    </div>
                  )}

                  {section.rhythm && (
                    <div className="element-box">
                      <h4>Rhythm / リズム {section.rhythm.feel ? `[${section.rhythm.feel}]` : ''}</h4>
                      {section.rhythm.grooveDescription && (
                        <p style={{ margin: '0 0 6px' }}>{section.rhythm.grooveDescription}</p>
                      )}
                      {section.rhythm.drumNotes && (
                        <p className="muted" style={{ margin: '0 0 4px' }}>
                          Drum: {section.rhythm.drumNotes}
                        </p>
                      )}
                      {section.rhythm.bassNotes && (
                        <p className="muted" style={{ margin: 0 }}>
                          Bass: {section.rhythm.bassNotes}
                        </p>
                      )}
                    </div>
                  )}

                  {section.melody && (
                    <div className="element-box">
                      <h4>Melody / メロディー</h4>
                      {section.melody.scaleOrMode && (
                        <p style={{ margin: '0 0 4px', fontFamily: 'var(--mono)' }}>
                          Scale: {section.melody.scaleOrMode}
                        </p>
                      )}
                      {section.melody.contour && (
                        <p style={{ margin: '0 0 4px' }}>{section.melody.contour}</p>
                      )}
                      {section.melody.hookDescription && (
                        <p className="muted" style={{ margin: 0 }}>
                          {section.melody.hookDescription}
                        </p>
                      )}
                    </div>
                  )}
                </div>

                <div className="action-row">
                  <button
                    type="button"
                    className="btn btn-primary btn-sm"
                    onClick={() => onSelectTrack(track.id, section.id)}
                  >
                    詳細とMIDI試聴を開く
                  </button>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => handleCopyForChatGpt(track, section.id)}
                  >
                    ChatGPT用要約をコピー
                  </button>
                  {section.midiClips && section.midiClips.length > 0 && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() => onOpenClipInStudio(section.midiClips![0])}
                    >
                      MIDIスタジオへ送る
                    </button>
                  )}
                </div>
              </article>
            );
          })}
        </div>
      )}
    </div>
  );
}
