# 音楽理論・和声出典レジストリ (SOURCES)

この文書は、[Sachitama2001/MusicTheory](https://github.com/Sachitama2001/MusicTheory) から統合した `data/theory/` 配下のコード進行・和声・知覚研究レコードの出典一覧である。著作権尊重のため、記事全文や譜面・商用MIDIは格納せず、簡潔な要約と出典URL・アクセス日のみを保持する。初期アクセス日: 2026-11-26。

## ChordTube
- サイト: https://chordtube.net/
- 本リポジトリにおける実曲コード進行データベースの正本ソース。正規化されたコード名、度数表記、キー、BPMを読み取って `data/tracks/` へ記録する。

## SoundQuest — 自由派音楽理論
- メインサイト: https://soundquest.jp/
- 目次: https://soundquest.jp/quest/
- 著者: yuta（トライトーン代理は plugmon）
- 主な参照記事:
  - 二次ドミナント: https://soundquest.jp/quest/chord/chord-mv2/secondary-dominant/
  - パラレル・マイナー: https://soundquest.jp/quest/chord/chord-mv2/parallel-minor/
  - パッシング・ディミニッシュ: https://soundquest.jp/quest/chord/chord-mv4/passing-chord/
  - トライトーン代理: https://soundquest.jp/quest/chord/chord-mv4/tritone-substitution/
  - モーダル・インターチェンジ: https://soundquest.jp/quest/chord/chord-mv6/ttj-modal-interchange/
  - 和声：標準連結と原則: https://soundquest.jp/quest/chord/chord-mv7/harmony-principles/
  - 和声：第一転回形: https://soundquest.jp/quest/chord/chord-mv7/harmony-1st-inversion/
  - 和声：第二・第三転回形: https://soundquest.jp/quest/chord/chord-mv7/harmony-2nd-3rd-inversion/

## SRM Music / するめミュージック
- 著者: SRM.
- 主な参照記事:
  - 理論概要: https://srm-music.com/theory-summary/
  - セカンダリードミナントとリレイテッドII: https://srm-music.com/two-five/
  - コード進行の変換テクニック: https://srm-music.com/code/
  - 定番の3進行: https://srm-music.com/3motions/
  - おしゃれコード進行一覧: https://srm-music.com/stylish-chord/

## うちやま作曲教室 — 内山敦支
- 記事: https://sakkyoku.info/theory/calm-chord-progression-pattern/
- 公開日: 2023-06-29
- 内容: 落ち着いた雰囲気を持つトニック・サブドミナント中心の進行、サブドミナントマイナー、クリシェ、オンコードの解説。

## Berklee Online — Harmony & Piano Voicing
- Chord Substitution and Reharmonization: https://online.berklee.edu/takenote/reharmonization-simple-substitution/
- Voice Leading Paradigms: https://online.berklee.edu/takenote/voice-leading-paradigms-for-harmony-in-music-composition/
- Piano Voicing Techniques: https://online.berklee.edu/takenote/basic-piano-voicing-techniques/
- Randy Felts *Reharmonization Techniques* に基づくガイドトーン・代理和音・ボイスリーディング原則。

## 学術研究 — 協和・不協和と感情知覚
- Consonance and dissonance perception: https://doi.org/10.1016/j.plrev.2022.10.004 (Nicola Di Stefano, Peter Vuust, Elvira Brattico, *Physics of Life Reviews*, 2022)
- Timbral effects on consonance: https://www.nature.com/articles/s41467-024-45812-z (Raja Marjieh et al., *Nature Communications*, 2024)
- Chord progressions and groove: https://link.springer.com/article/10.1007/s00426-023-01869-x (Satoshi Kawase, 2023)

## 出典・レビュー方針
- 出典のある理論・学術研究・プロジェクト独自仮説を `evidence_type` で区別する。
- `review_status: "pending"` のレコードはWebアプリの閲覧一覧には確認待ちとして表示するが、LLMによる作曲推薦の根拠には使用しない。
