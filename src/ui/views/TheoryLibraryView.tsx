import { useMemo, useState } from 'react';
import type {
  HarmonyTechnique,
  ProgressionRecord,
  TheoryKnowledgeBase
} from '../../schema';
import { isValidChordSymbol, type ChordInput } from '../../midi/chordEngine';
import { ChordMidiPlayer } from '../components/ChordMidiPlayer';

interface TheoryLibraryViewProps {
  theory: TheoryKnowledgeBase;
  onSendToLab: (quickLine: string, bpm: number, key: string) => void;
  onNotify: (msg: string) => void;
}

type SubTab = 'progressions' | 'techniques' | 'styles' | 'rules';

function toChordInputs(symbols: string[], degrees?: string[] | null, beatsPerChord = 2): ChordInput[] {
  return symbols.map((symbol, idx) => ({
    symbol,
    roman: degrees && degrees[idx] ? degrees[idx] : undefined,
    beats: beatsPerChord
  }));
}

function allSymbolsPlayable(symbols: string[]): boolean {
  return symbols.length > 0 && symbols.every((s) => isValidChordSymbol(s));
}

export function TheoryLibraryView({
  theory,
  onSendToLab,
  onNotify
}: TheoryLibraryViewProps) {
  const [subTab, setSubTab] = useState<SubTab>('progressions');
  const [query, setQuery] = useState('');
  const [hidePending, setHidePending] = useState(false);

  const [openProgId, setOpenProgId] = useState<string | null>(null);
  const [openTechState, setOpenTechState] = useState<{
    id: string;
    slot: 'before' | 'after';
  } | null>(null);

  const q = query.trim().toLowerCase();

  const filteredProgressions = useMemo(() => {
    return theory.progressions.filter((item) => {
      if (hidePending && item.review_status === 'pending') return false;
      if (!q) return true;
      const hay = [
        item.id,
        item.name,
        ...(item.degrees ?? []),
        ...item.example,
        ...item.tags,
        item.harmonicRhythm ?? '',
        item.notes ?? '',
        item.source?.title ?? '',
        item.source?.author ?? ''
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [theory.progressions, hidePending, q]);

  const filteredTechniques = useMemo(() => {
    return theory.harmonyTechniques.filter((item) => {
      if (hidePending && item.review_status === 'pending') return false;
      if (!q) return true;
      const hay = [
        item.id,
        item.name,
        item.summary,
        item.useWhen ?? '',
        item.caution ?? '',
        ...item.before,
        ...item.after,
        ...item.tags,
        item.source?.title ?? ''
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [theory.harmonyTechniques, hidePending, q]);

  const filteredStyles = useMemo(() => {
    return theory.styleMoods.filter((item) => {
      if (hidePending && item.review_status === 'pending') return false;
      if (!q) return true;
      const hay = [
        item.id,
        item.name,
        ...item.tags,
        ...item.harmonyTendencies,
        ...item.arrangementTendencies,
        item.notes ?? '',
        item.source?.title ?? ''
      ]
        .join(' ')
        .toLowerCase();
      return hay.includes(q);
    });
  }, [theory.styleMoods, hidePending, q]);

  const filteredRules = useMemo(() => {
    return theory.compositionRules.filter((item) => {
      if (!q) return true;
      const hay = [item.id, item.name, item.rule, item.notes ?? ''].join(' ').toLowerCase();
      return hay.includes(q);
    });
  }, [theory.compositionRules, q]);

  function copyProgressionCitation(p: ProgressionRecord) {
    const lines = [
      `### 理論ライブラリ参照: [${p.id}] ${p.name}`,
      `- Degrees: ${p.degrees && p.degrees.length > 0 ? p.degrees.join(' -> ') : '(なし)'}`,
      `- Example (${p.exampleKey ?? 'N/A'}): ${p.example.join(' -> ')}`,
      `- Tags: ${p.tags.join(', ')}`,
      `- Evidence: ${p.evidence_type} (confidence: ${p.confidence})`,
      p.source?.url ? `- Source: ${p.source.title} (${p.source.url})` : '',
      '',
      'この理論パターンとリポジトリの LLM_GUIDE.md に従い、私の曲のキーに合わせたコード進行案を `コード名(拍数)` 形式で提案してください。'
    ].filter(Boolean);
    void navigator.clipboard.writeText(lines.join('\n')).then(() => {
      onNotify(`${p.id} のChatGPT用引用プロンプトをコピーしました`);
    });
  }

  function copyTechniqueCitation(t: HarmonyTechnique) {
    const lines = [
      `### 和声テクニック参照: [${t.id}] ${t.name}`,
      `- Summary: ${t.summary}`,
      t.before.length ? `- Before: ${t.before.join(' -> ')}` : '',
      t.after.length ? `- After: ${t.after.join(' -> ')}` : '',
      t.useWhen ? `- Use when: ${t.useWhen}` : '',
      t.caution ? `- Caution: ${t.caution}` : '',
      t.source?.url ? `- Source: ${t.source.title} (${t.source.url})` : '',
      '',
      `このテクニック [${t.id}] を私のコード進行へ適用したアレンジ案を、元の進行と対比して \`コード名(拍数)\` 形式で提案してください。`
    ].filter(Boolean);
    void navigator.clipboard.writeText(lines.join('\n')).then(() => {
      onNotify(`${t.id} のChatGPT用テクニック適用プロンプトをコピーしました`);
    });
  }

  const pendingProgCount = theory.progressions.filter((p) => p.review_status === 'pending').length;

  return (
    <div>
      <section className="panel">
        <div className="card-header">
          <div>
            <h2 className="section-heading" style={{ marginBottom: 4 }}>
              音楽理論・和声ライブラリ (MusicTheory 統合知識)
            </h2>
            <p className="muted" style={{ margin: 0 }}>
              出典付きコード進行パターン、Before/Afterで聴き比べできる和声テクニック、スタイル・知覚研究、作曲原則を横断検索できます。
              <code>pending</code> レコード ({pendingProgCount}件) は画面で閲覧できますが、LLMの自動推薦根拠からは除外されます。
            </p>
          </div>
        </div>

        <div className="nav-tabs" style={{ marginTop: 12 }}>
          <button
            type="button"
            className={`nav-tab ${subTab === 'progressions' ? 'active' : ''}`}
            onClick={() => setSubTab('progressions')}
          >
            コード進行パターン ({theory.progressions.length})
          </button>
          <button
            type="button"
            className={`nav-tab ${subTab === 'techniques' ? 'active' : ''}`}
            onClick={() => setSubTab('techniques')}
          >
            和声テクニック ({theory.harmonyTechniques.length})
          </button>
          <button
            type="button"
            className={`nav-tab ${subTab === 'styles' ? 'active' : ''}`}
            onClick={() => setSubTab('styles')}
          >
            スタイル・ムード＆研究 ({theory.styleMoods.length})
          </button>
          <button
            type="button"
            className={`nav-tab ${subTab === 'rules' ? 'active' : ''}`}
            onClick={() => setSubTab('rules')}
          >
            作曲・データ原則 ({theory.compositionRules.length})
          </button>
        </div>

        <div className="search-bar-row" style={{ marginTop: 12 }}>
          <input
            type="search"
            className="input"
            placeholder="キーワード、ID、度数、タグで絞り込み (例: calm / secondary / tritone / IV V / city-pop)"
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            aria-label="理論ライブラリ検索"
          />
          <button
            type="button"
            className={`btn ${hidePending ? 'btn-active' : ''}`}
            onClick={() => setHidePending((v) => !v)}
          >
            {hidePending ? '承認済みのみ表示中' : 'Pendingも表示中'}
          </button>
        </div>
      </section>

      {subTab === 'progressions' && (
        <div className="card-list">
          {filteredProgressions.map((p) => {
            const playable = allSymbolsPlayable(p.example);
            const isOpen = openProgId === p.id;
            const keyStr = p.exampleKey ? `${p.exampleKey} major` : 'C major';
            return (
              <article className="result-card" key={p.id}>
                <div className="card-header">
                  <div>
                    <h3 className="card-title">
                      <span className="chip" style={{ fontFamily: 'var(--mono)', marginRight: 6 }}>
                        {p.id}
                      </span>
                      {p.name}
                      {p.review_status === 'pending' && (
                        <span
                          className="chip"
                          style={{
                            marginLeft: 8,
                            borderColor: 'var(--warn)',
                            color: 'var(--warn)'
                          }}
                        >
                          pending (LLM除外)
                        </span>
                      )}
                    </h3>
                    <div className="meta-inline" style={{ marginTop: 4 }}>
                      <span>Evidence: {p.evidence_type}</span>
                      <span>Confidence: {p.confidence}</span>
                      {p.exampleKey && <span>Key: {p.exampleKey}</span>}
                      {p.harmonicRhythm && <span>Rhythm: {p.harmonicRhythm}</span>}
                    </div>
                  </div>
                  <div className="chip-row">
                    {p.tags.map((tag) => (
                      <span key={tag} className="chip">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                {p.degrees && p.degrees.length > 0 && (
                  <div className="chip-row" style={{ marginBottom: 6 }}>
                    {p.degrees.map((d, i) => (
                      <span key={`${d}-${i}`} className="chip chip-roman">
                        {d}
                      </span>
                    ))}
                  </div>
                )}

                {p.example.length > 0 && (
                  <div className="chip-row" style={{ marginBottom: 8 }}>
                    {p.example.map((c, i) => (
                      <span key={`${c}-${i}`} className="chip chip-chord">
                        {c}
                      </span>
                    ))}
                  </div>
                )}

                {p.notes && <p className="muted" style={{ margin: '4px 0' }}>{p.notes}</p>}

                {p.source && (
                  <p className="muted" style={{ margin: '4px 0' }}>
                    出典: {p.source.author ? `${p.source.author} — ` : ''}
                    {p.source.url ? (
                      <a
                        href={p.source.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--accent)' }}
                      >
                        {p.source.title} ↗
                      </a>
                    ) : (
                      p.source.title
                    )}
                  </p>
                )}

                <div className="action-row">
                  {playable && (
                    <button
                      type="button"
                      className={`btn btn-sm ${isOpen ? 'btn-active' : 'btn-primary'}`}
                      onClick={() => setOpenProgId((prev) => (prev === p.id ? null : p.id))}
                    >
                      {isOpen ? 'ピアノ試聴を閉じる' : 'ピアノ試聴 / .mid書き出し'}
                    </button>
                  )}
                  {playable && (
                    <button
                      type="button"
                      className="btn btn-sm"
                      onClick={() =>
                        onSendToLab(
                          p.example.map((c) => `${c}(2)`).join(' '),
                          120,
                          keyStr
                        )
                      }
                    >
                      試聴ラボへ送る
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => copyProgressionCitation(p)}
                  >
                    ChatGPT引用コピー
                  </button>
                </div>

                {isOpen && playable && (
                  <ChordMidiPlayer
                    title={`${p.id}-${p.name}`}
                    chords={toChordInputs(p.example, p.degrees, 2)}
                    defaultBpm={120}
                    baseKey={keyStr}
                    onNotify={onNotify}
                    onSendToLab={onSendToLab}
                  />
                )}
              </article>
            );
          })}
        </div>
      )}

      {subTab === 'techniques' && (
        <div className="card-list">
          {filteredTechniques.map((t) => {
            const beforePlayable = allSymbolsPlayable(t.before);
            const afterPlayable = allSymbolsPlayable(t.after);
            const isThisOpen = openTechState?.id === t.id;
            const activeSlot = isThisOpen ? openTechState.slot : 'after';

            return (
              <article className="result-card" key={t.id}>
                <div className="card-header">
                  <div>
                    <h3 className="card-title">
                      <span className="chip" style={{ fontFamily: 'var(--mono)', marginRight: 6 }}>
                        {t.id}
                      </span>
                      {t.name}
                    </h3>
                    <div className="meta-inline" style={{ marginTop: 4 }}>
                      <span>Evidence: {t.evidence_type}</span>
                      <span>Confidence: {t.confidence}</span>
                    </div>
                  </div>
                  <div className="chip-row">
                    {t.tags.map((tag) => (
                      <span key={tag} className="chip">
                        #{tag}
                      </span>
                    ))}
                  </div>
                </div>

                <p style={{ margin: '6px 0' }}>{t.summary}</p>

                <div className="elements-grid">
                  {t.before.length > 0 && (
                    <div className="element-box">
                      <h4>Before (変換前)</h4>
                      <div className="chip-row">
                        {t.before.map((c, i) => (
                          <span key={`${c}-${i}`} className="chip">
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                  {t.after.length > 0 && (
                    <div className="element-box">
                      <h4>After (テクニック適用後)</h4>
                      <div className="chip-row">
                        {t.after.map((c, i) => (
                          <span key={`${c}-${i}`} className="chip chip-chord">
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}
                </div>

                {t.useWhen && (
                  <p className="muted" style={{ margin: '8px 0 4px' }}>
                    <strong>使いどころ:</strong> {t.useWhen}
                  </p>
                )}
                {t.caution && (
                  <p className="muted" style={{ margin: '4px 0' }}>
                    <strong>注意点:</strong> {t.caution}
                  </p>
                )}

                {t.source && (
                  <p className="muted" style={{ margin: '4px 0' }}>
                    出典: {t.source.author ? `${t.source.author} — ` : ''}
                    {t.source.url ? (
                      <a
                        href={t.source.url}
                        target="_blank"
                        rel="noreferrer"
                        style={{ color: 'var(--accent)' }}
                      >
                        {t.source.title} ↗
                      </a>
                    ) : (
                      t.source.title
                    )}
                  </p>
                )}

                <div className="action-row">
                  {beforePlayable && (
                    <button
                      type="button"
                      className={`btn btn-sm ${
                        isThisOpen && activeSlot === 'before' ? 'btn-active' : ''
                      }`}
                      onClick={() =>
                        setOpenTechState((prev) =>
                          prev?.id === t.id && prev.slot === 'before'
                            ? null
                            : { id: t.id, slot: 'before' }
                        )
                      }
                    >
                      Beforeを試聴
                    </button>
                  )}
                  {afterPlayable && (
                    <button
                      type="button"
                      className={`btn btn-sm ${
                        isThisOpen && activeSlot === 'after' ? 'btn-active' : 'btn-primary'
                      }`}
                      onClick={() =>
                        setOpenTechState((prev) =>
                          prev?.id === t.id && prev.slot === 'after'
                            ? null
                            : { id: t.id, slot: 'after' }
                        )
                      }
                    >
                      Afterを試聴 / .mid書き出し
                    </button>
                  )}
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => copyTechniqueCitation(t)}
                  >
                    ChatGPT適用プロンプトコピー
                  </button>
                </div>

                {isThisOpen && (
                  <ChordMidiPlayer
                    title={`${t.id}-${activeSlot}`}
                    chords={toChordInputs(
                      activeSlot === 'before' ? t.before : t.after,
                      undefined,
                      2
                    )}
                    defaultBpm={112}
                    onNotify={onNotify}
                    onSendToLab={onSendToLab}
                  />
                )}
              </article>
            );
          })}
        </div>
      )}

      {subTab === 'styles' && (
        <div className="card-list">
          {filteredStyles.map((s) => (
            <article className="result-card" key={s.id}>
              <div className="card-header">
                <div>
                  <h3 className="card-title">
                    <span className="chip" style={{ fontFamily: 'var(--mono)', marginRight: 6 }}>
                      {s.id}
                    </span>
                    {s.name}
                  </h3>
                  <div className="meta-inline" style={{ marginTop: 4 }}>
                    <span>Evidence: {s.evidence_type}</span>
                    <span>Confidence: {s.confidence}</span>
                  </div>
                </div>
                <div className="chip-row">
                  {s.tags.map((tag) => (
                    <span key={tag} className="chip chip-feeling">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              {s.harmonyTendencies.length > 0 && (
                <div className="element-box" style={{ marginTop: 8 }}>
                  <h4>和声・コード傾向</h4>
                  <ul style={{ margin: 0, paddingLeft: 18 }}>
                    {s.harmonyTendencies.map((h, i) => (
                      <li key={i}>{h}</li>
                    ))}
                  </ul>
                </div>
              )}

              {s.notes && <p className="muted" style={{ margin: '8px 0 4px' }}>{s.notes}</p>}

              {s.source && (
                <p className="muted" style={{ margin: '4px 0 0' }}>
                  出典: {s.source.author ? `${s.source.author} — ` : ''}
                  {s.source.url ? (
                    <a
                      href={s.source.url}
                      target="_blank"
                      rel="noreferrer"
                      style={{ color: 'var(--accent)' }}
                    >
                      {s.source.title} ↗
                    </a>
                  ) : (
                    s.source.title
                  )}
                </p>
              )}
            </article>
          ))}
        </div>
      )}

      {subTab === 'rules' && (
        <div className="card-list">
          {filteredRules.map((r) => (
            <article className="result-card" key={r.id}>
              <div className="card-header">
                <h3 className="card-title">
                  <span className="chip" style={{ fontFamily: 'var(--mono)', marginRight: 6 }}>
                    {r.id}
                  </span>
                  {r.name}
                </h3>
                <div className="chip-row">
                  <span className="chip">{r.priority}</span>
                  <span className="chip">{r.evidence_type}</span>
                </div>
              </div>
              <p style={{ margin: '6px 0' }}>{r.rule}</p>
              {r.notes && <p className="muted" style={{ margin: '4px 0' }}>{r.notes}</p>}
              {r.source?.url && (
                <p className="muted" style={{ margin: '4px 0 0' }}>
                  出典:{' '}
                  <a
                    href={r.source.url}
                    target="_blank"
                    rel="noreferrer"
                    style={{ color: 'var(--accent)' }}
                  >
                    {r.source.title} ↗
                  </a>
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </div>
  );
}
