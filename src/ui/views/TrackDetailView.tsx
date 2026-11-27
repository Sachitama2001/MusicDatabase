import type { MidiClip, Track } from '../../schema';
import { formatSectionForChatGpt } from '../../search/engine';
import { MidiPlayerCard } from '../components/MidiPlayerCard';

interface TrackDetailViewProps {
  tracks: Track[];
  selectedTrackId: string | null;
  highlightSectionId: string | null;
  onSelectTrack: (trackId: string) => void;
  onOpenClipInStudio: (clip: MidiClip) => void;
  onNotify: (msg: string) => void;
}

export function TrackDetailView({
  tracks,
  selectedTrackId,
  highlightSectionId,
  onSelectTrack,
  onOpenClipInStudio,
  onNotify
}: TrackDetailViewProps) {
  const activeTrack =
    tracks.find((t) => t.id === selectedTrackId) ?? (tracks.length > 0 ? tracks[0] : null);

  function copyTrackJson(track: Track) {
    void navigator.clipboard.writeText(JSON.stringify(track, null, 2)).then(() => {
      onNotify(`${track.id}.json をクリップボードへコピーしました`);
    });
  }

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
              <span>{track.bpm ? `${track.bpm} BPM` : '-'}</span>
              <span>{track.key ?? '-'}</span>
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
                    <span>BPM: {activeTrack.bpm ?? '-'}</span>
                    <span>Key: {activeTrack.key ?? '-'}</span>
                    <span>Time: {activeTrack.timeSignature ?? '-'}</span>
                    {activeTrack.releaseYear && <span>Year: {activeTrack.releaseYear}</span>}
                    <span>Version: {activeTrack.versionType}</span>
                  </div>
                </div>
                <button
                  type="button"
                  className="btn btn-sm"
                  onClick={() => copyTrackJson(activeTrack)}
                >
                  Track JSONコピー
                </button>
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

              {activeTrack.references && activeTrack.references.length > 0 && (
                <div className="action-row">
                  {activeTrack.references.map((ref, i) => (
                    <a
                      key={`${ref.url}-${i}`}
                      href={ref.url}
                      target="_blank"
                      rel="noreferrer"
                      className="btn btn-sm"
                      style={{ textDecoration: 'none' }}
                    >
                      [{ref.kind}] {ref.label}
                    </a>
                  ))}
                </div>
              )}
            </section>

            {[...activeTrack.sections]
              .sort((a, b) => a.order - b.order)
              .map((section) => {
                const isHighlighted = highlightSectionId === section.id;
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
                          <span>BPM: {section.localBpm ?? activeTrack.bpm ?? '-'}</span>
                          <span>Key: {section.localKey ?? activeTrack.key ?? '-'}</span>
                          {section.startBar !== undefined && (
                            <span>
                              Bars: {section.startBar}
                              {section.endBar !== undefined ? `-${section.endBar}` : ''}
                            </span>
                          )}
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
                        ChatGPT用要約をコピー
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

                    <div className="elements-grid">
                      {section.harmony && (
                        <div className="element-box">
                          <h4>Harmony / コード</h4>
                          {section.harmony.romanNumerals && (
                            <div className="chip-row" style={{ marginBottom: 6 }}>
                              {section.harmony.romanNumerals.map((r, idx) => (
                                <span key={`${r}-${idx}`} className="chip chip-roman">
                                  {r}
                                </span>
                              ))}
                            </div>
                          )}
                          {section.harmony.chordProgression && (
                            <div className="chip-row" style={{ marginBottom: 6 }}>
                              {section.harmony.chordProgression.map((c, idx) => (
                                <span key={`${c}-${idx}`} className="chip chip-chord">
                                  {c}
                                </span>
                              ))}
                            </div>
                          )}
                          {section.harmony.cadenceOrMotion && (
                            <p style={{ margin: '0 0 6px' }}>{section.harmony.cadenceOrMotion}</p>
                          )}
                          {section.harmony.voicingNotes && (
                            <p className="muted" style={{ margin: 0 }}>
                              Voicing: {section.harmony.voicingNotes}
                            </p>
                          )}
                        </div>
                      )}

                      {section.rhythm && (
                        <div className="element-box">
                          <h4>
                            Rhythm / リズム {section.rhythm.feel ? `[${section.rhythm.feel}]` : ''}
                          </h4>
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
                              Hook: {section.melody.hookDescription}
                            </p>
                          )}
                        </div>
                      )}
                    </div>

                    {section.midiClips && section.midiClips.length > 0 && (
                      <div style={{ marginTop: 12 }}>
                        {section.midiClips.map((clip) => (
                          <MidiPlayerCard
                            key={clip.id}
                            clip={clip}
                            onNotify={onNotify}
                            onOpenInStudio={onOpenClipInStudio}
                          />
                        ))}
                      </div>
                    )}
                  </section>
                );
              })}
          </>
        )}
      </div>
    </div>
  );
}
