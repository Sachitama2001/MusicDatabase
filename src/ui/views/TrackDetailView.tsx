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
