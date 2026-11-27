# ADR 0003: Sachitama2001/MusicTheory 知識ベースの統合

- 状態: 採用
- 日付: 2026-11-27

## 背景

ユーザーは既に [Sachitama2001/MusicTheory](https://github.com/Sachitama2001/MusicTheory) に、出典・信頼度・レビュー状態を管理したコード進行パターン、和声変換テクニック、スタイル・ムード傾向と知覚研究、およびデータガバナンス原則を蓄積していた。これらを `MusicDatabase` のChordTube実曲データベースと統合し、作曲時の参照・試聴・LLM提案の精度を高める必要があった。

## 決定

1. `MusicTheory` のうちコード進行・和声・知覚・データガバナンスに該当する4ライブラリ（合計78レコード）を `data/theory/` 配下へ統合する。
   - `data/theory/progressions.json`（37件）
   - `data/theory/harmony-techniques.json`（22件）
   - `data/theory/style-moods.json`（12件。純粋なリズム・スウィング専用の `STYLE-010` のみ除外）
   - `data/theory/composition-rules.json`（7件。3トラック・リズム専用の `RULE-001`, `RULE-002`, `RULE-007`, `RULE-011` を除外）
   - リズム専用ライブラリ `arrangements.json` はADR 0002のコード進行特化方針に従い除外する。
2. 出典レジストリを `docs/SOURCES.md` として統合し、`evidence_type`・`confidence`・`review_status` を保持する。
3. `review_status: "pending"` のレコードはWebアプリ上に確認待ちとして表示するが、LLMの作曲推薦根拠からは除外するガバナンス規約を `LLM_GUIDE.md` に継承する。
4. `chordEngine.ts` を拡張し、`Am7(9)`, `G7sus(9)`, `Am7(11)omit3`, `Dm(b5)` といった `MusicTheory` 側のコード表記をすべて決定論的にPiano MIDIへ変換できるようにする。

## 影響

- ユーザーはChordTube実曲のコード進行だけでなく、37件の理論進行パターンと19件の和声テクニック（Before/After聴き比べ）を同じPiano MIDIエンジンで試聴・移調・`.mid` 書き出しできる。
- ChatGPTは `data/index.json` を読むだけで、実曲の好みと出典付き和声テクニックの両方を横断したアレンジ提案を行える。
