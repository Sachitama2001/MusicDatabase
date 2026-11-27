import type { Track } from '../../schema';
import { formatSectionForChatGpt } from '../../search/engine';
import { ChordMidiPlayer } from '../components/ChordMidiPlayer';

interface TrackDetailViewProps {
  tracks: Track[];
  selectedTrackId: string | null;
  highlightSectionId: string | null;
  onSelectTrack: (trackId: string) => void;
  onSendToLab: (quickLine: string, bpm: number, key: string) => void;
  onNotify: (msg: string) => void;
}

export function TrackDetailView({
  tracks,
  selectedTrackId,
  highlightSectionId,
  onSelectTrack,
  onSendToLab,
  onNotify
}: TrackDetailViewProps) {
  const activeTrack =
    tracks.find((t) => t.id === selectedTrackId) ?? (tracks.length > 0 ? tracks[0] : null);

  return (
    <div className="detail-layout">
      <aside className="panel" style={{ alignSelf: 'start' }}>
        <h2 className="section-heading">登録楽曲 ({tracks.length})</h2>
        {tracks.map((track) => (
          <button
            key={track.id}
            type="button"
            className={`track-list-item ${activeTrack?.id === track.id ? 'active' : ''}`}
            onClick={() => onSelectTrack(track.id)}
          >
            <div style={{ fontWeight: 600 }}>{track.title}</div>
            <div className="muted">{track.artist}</div>
            <div className="meta-inline" style={{ marginTop: 4, fontSize: '0.75rem' }}>
              <span>{track.bpm} BPM</span>
              <span>{track.key}</span>
              <span>{track.sections.length} sec</span>
            </div>
          </button>
        ))}
      </aside>

      <div>
        {!activeTrack ? (
          <section className="panel">
            <p className="muted">登録されている楽曲がありません。</p>
          </section>
        ) : (
          <>
            <section className="panel">
              <div className="card-header">
                <div>
                  <h2 style={{ margin: 0 }}>
                    {activeTrack.artist} — {activeTrack.title}
                  </h2>
                  <div className="meta-inline" style={{ marginTop: 6 }}>
                    <span>ID: {activeTrack.id}</span>
                    <span>BPM: {activeTrack.bpm}</span>
                    <span>Key: {activeTrack.key}</span>
                    <span>Time: {activeTrack.timeSignature}</span>
                    {activeTrack.releaseYear && <span>Year: {activeTrack.releaseYear}</span>}
                  </div>
                </div>
                <div className="action-row" style={{ marginTop: 0 }}>
                  <a
                    href={activeTrack.source.url}
                    target="_blank"
                    rel="noreferrer"
                    className="btn btn-primary btn-sm"
                    style={{ textDecoration: 'none' }}
                  >
                    ChordTube で開く ↗
                  </a>
                  <button
                    type="button"
                    className="btn btn-sm"
                    onClick={() => {
                      void navigator.clipboard
                        .writeText(JSON.stringify(activeTrack, null, 2))
                        .then(() => onNotify(`${activeTrack.id}.json をコピーしました`));
                    }}
                  >
                    Track JSONコピー
                  </button>
                </div>
              </div>

              {activeTrack.overallFeelings && activeTrack.overallFeelings.length > 0 && (
                <div className="chip-row" style={{ marginTop: 8 }}>
                  {activeTrack.overallFeelings.map((f) => (
                    <span key={f} className="chip chip-feeling">
                      {f}
                    </span>
                  ))}
                </div>
              )}

              {activeTrack.notes && (
                <p style={{ marginTop: 10, marginBottom: 0 }}>{activeTrack.notes}</p>
              )}
            </section>

            {[...activeTrack.sections]
              .sort((a, b) => a.order - b.order)
              .map((section) => {
                const isHighlighted = highlightSectionId === section.id;
                const secBpm = section.localBpm ?? activeTrack.bpm;
                const secKey = section.localKey ?? activeTrack.key;
                const secTs = section.localTimeSignature ?? activeTrack.timeSignature;

                return (
                  <section
                    key={section.id}
                    className="panel"
                    style={
                      isHighlighted
                        ? { borderColor: 'var(--accent)', boxShadow: '0 0 0 1px var(--accent)' }
                        : undefined
                    }
                  >
                    <div className="card-header">
                      <div>
                        <h3 className="card-title">
                          #{section.order} {section.displayName}{' '}
                          <span className="chip">{section.label}</span>
                        </h3>
                        <div className="meta-inline" style={{ marginTop: 4 }}>
                          <span>BPM: {secBpm}</span>
                          <span>Key: {secKey}</span>
                          <span>Time: {secTs}</span>
                          {section.startSec !== undefined && (
                            <span>
                              Sec: {section.startSec}s
                              {section.endSec !== undefined ? `-${section.endSec}s` : ''}
                            </span>
                          )}
                          {section.rating && <span>Rating: {'★'.repeat(section.rating)}</span>}
                        </div>
                      </div>
                      <button
                        type="button"
                        className="btn btn-sm"
                        onClick={() => {
                          void navigator.clipboard
                            .writeText(formatSectionForChatGpt(activeTrack, section))
                            .then(() => onNotify('ChatGPT用セクション要約をコピーしました'));
                        }}
                      >
                        ChatGPT用要約コピー
                      </button>
                    </div>

                    <div className="chip-row" style={{ marginBottom: 8 }}>
                      {section.feelings.map((f) => (
                        <span key={f} className="chip chip-feeling">
                          {f}
                        </span>
                      ))}
                      {(section.tags ?? []).map((t) => (
                        <span key={t} className="chip">
                          #{t}
                        </span>
                      ))}
                    </div>

                    <div className="summary-quote">{section.feelingSummary}</div>

                    {section.cadenceOrMotion && (
                      <p className="muted" style={{ marginTop: 6 }}>
                        進行の特徴: {section.cadenceOrMotion}
                      </p>
                    )}

                    {section.theoryAnnotations && section.theoryAnnotations.length > 0 && (
                      <div style={{ marginTop: 12, borderTop: '1px solid var(--border)', paddingTop: 10 }}>
                        <h4 style={{ margin: '0 0 8px' }}>音楽理論の注釈・出典</h4>
                        <div style={{ display: 'grid', gap: 10 }}>
                          {section.theoryAnnotations.map((annotation) => (
                            <article key={annotation.id} style={{ padding: 10, border: '1px solid var(--border)', borderRadius: 8 }}>
                              <div className="card-header" style={{ alignItems: 'center' }}>
                                <strong>{annotation.technique}</strong>
                                <div className="chip-row">
                                  <span className="chip">{annotation.matchType === 'direct' ? '直接一致' : annotation.matchType === 'partial' ? '部分一致' : '分析上の推論'}</span>
                                  <span className="chip">確度: {annotation.confidence}</span>
                                </div>
                              </div>
                              {annotation.location && <p className="muted" style={{ margin: '4px 0' }}>該当箇所: {annotation.location}</p>}
                              <p style={{ margin: '6px 0' }}>{annotation.note}</p>
                              {annotation.theoryRefs.length > 0 && (
                                <div className="chip-row" style={{ marginBottom: 6 }}>
                                  {annotation.theoryRefs.map((ref) => <span className="chip chip-roman" key={ref}>{ref}</span>)}
                                </div>
                              )}
                              {annotation.sources.map((source) => (
                                <p className="muted" key={source.recordId} style={{ margin: '4px 0', fontSize: '0.85rem' }}>
                                  出典 [{source.recordId}]: {source.author ? `${source.author} — ` : ''}
                                  {source.url ? <a href={source.url} target="_blank" rel="noreferrer" style={{ color: 'var(--accent)' }}>{source.title} ↗</a> : source.title}
                                  {source.reviewStatus === 'pending' ? '（理論DB内で確認待ち）' : ''}
                                </p>
                              ))}
                              {annotation.sourceNote && <p className="muted" style={{ margin: '4px 0', fontSize: '0.8rem' }}>コード譜根拠: {annotation.sourceNote}</p>}
                              {annotation.caveat && <p className="muted" style={{ margin: '4px 0', fontSize: '0.8rem' }}>留意点: {annotation.caveat}</p>}
                            </article>
                          ))}
                        </div>
                      </div>
                    )}

                    <ChordMidiPlayer
                      title={`${activeTrack.artist}-${activeTrack.title}-${section.displayName}`}
                      chords={section.chords}
                      defaultBpm={secBpm}
                      baseKey={secKey}
                      timeSignature={secTs}
                      onNotify={onNotify}
                      onSendToLab={onSendToLab}
                    />
                  </section>
                );
              })}
          </>
        )}
      </div>
    </div>
  );
}
