# LLM_GUIDE.md — MusicDatabase 運用・データ仕様書 (v2: ChordTubeコード進行特化)

この文書は、事前の会話履歴を持たないLLMが、GitHub連携を通じて `MusicDatabase` リポジトリの読み取り、ChordTube由来のコード進行データベース登録・更新、および作曲時のコード進行提案を1ファイルだけで正確に実行するための仕様書である。

## 1. リポジトリの目的と前提ルール

`MusicDatabase` は、既存楽曲の**コード進行**とユーザー自身の**フィーリング**を結びつけて蓄積し、作曲時に雰囲気や度数進行からコード進行を検索して正確な**ピアノ用MIDI**としてDAWであるFender Studio Proへ持ち込むための個人専用データベースである。

### 絶対に守るべき3原則

1. **コード進行のみを扱う**: リズム、ドラム、ベース、メロディーの分析データや手打ちMIDIノート配列は扱わない。
2. **ChordTube掲載曲のみを登録する**: データソースは `https://chordtube.net/` に限定する。ChordTubeに掲載されていない曲のコード進行を推測や記憶だけで捏造しない。
3. **MIDIノート番号をLLMが手書きしない**: リポジトリにはChordTubeから読み取った正確なコード名 `symbol`、度数表記 `roman`、拍数 `beats` のみを保存する。ピアノ用MIDIファイルおよびブラウザ音声再生は、Webアプリの決定論的コードエンジンが `chords` 配列から自動生成する。

### ディレクトリと編集権限

| パス | 役割 | LLMによる直接編集 |
| --- | --- | --- |
| `data/tracks/<track-id>.json` | ChordTube由来の楽曲ごとのコード進行・フィーリング分析の正本。1楽曲につき1ファイル | 可。新規作成および更新の主対象 |
| `data/feelings.json` | フィーリング語彙と同義語の正規化辞書 | 可。頻出する新しい感情語彙や同義語を追加するときに更新 |
| `data/theory/progressions.json` | 出典付きコード進行パターン集（MusicTheory統合） | 可。新規理論を追加するときは `review_status: "pending"` で追記 |
| `data/theory/harmony-techniques.json` | Before/After形式の和声変換テクニック集 | 可。新規テクニックは出典URL付きで追記 |
| `data/theory/style-moods.json` | スタイル・ムード傾向と知覚研究の知見 | 可。出典と `evidence_type` を必ず明記 |
| `data/theory/composition-rules.json` | コード進行とデータガバナンスの原則集 | 原則変更時のみ可 |
| `data/index.json` | 全楽曲と全理論知識の集約インデックス。全件俯瞰の読み取りに使用 | 不可。CIまたは `npm run build:index` が自動生成する |
| `src/` `scripts/` | Webアプリ・コードMIDIエンジン・検証スクリプト | ユーザーから明示的な改修指示があるときのみ可 |
| `DEFINITION.md` | 要件定義書 | 仕様変更の指示があるときのみ可 |

### 理論知識ベース (`data/theory/`) の参照ガバナンスルール

`data/theory/` には [Sachitama2001/MusicTheory](https://github.com/Sachitama2001/MusicTheory) から統合したコード進行・和声テクニック・ムード傾向・作曲原則が格納されている。LLMは参照時に次の4原則を必ず守る。

1. **`review_status: "pending"` を根拠に使わない**: `review_status` が `"pending"` のレコードは人間レビュー待ちのため、作曲提案や理論解説の根拠から除外する。
2. **IDと出典を引用する (`RULE-005`)**: 理論レコードを参考に提案したときは、`[HARM-003]` や `[CALM-004]` のようにレコードIDを明記し、出典付き理論とプロジェクト独自の仮説を区別する。
3. **コード進行だけで感情を断定しない (`RULE-006`, `RULE-010`)**: ムードやスタイルのラベルは出典やユーザー聴取例に紐づく傾向として扱い、普遍的な法則のように断定しない。
4. **ハーモニックリズムを明示する (`RULE-008`)**: コード進行を提案するときは、必ず各コードの拍数を明示し、`コード名(拍数)` 記法で返す。

## 2. タスク別の実行手順

### タスクA: ユーザーのテキストからChordTubeを検索してデータベースへ登録する

ユーザーが「〇〇の△△のサビが切なくて好き」「この曲のコード進行を登録して」といったテキストを送ったとき、次の手順で実行する。

1. **ChordTubeを検索する**:
   - Web検索またはブラウジング機能を使い、`site:chordtube.net <曲名> <アーティスト名>` で対象楽曲のページを探す。
   - 対象楽曲が `https://chordtube.net/` 上に見つからない場合、**推測でコード進行を作ってはいけない**。見つからなかった事実をユーザーへ伝え、ChordTube上の該当URL、またはユーザーが画面から読み取ったコード進行テキストの提示を求める。
2. **ChordTubeページから音楽情報を正確に読み取る**:
   - ページURL、曲名 `title`、アーティスト名 `artist`、全体の `key`、全体の `bpm`、拍子 `timeSignature`。
   - ユーザーが言及したセクション（サビ、Aメロ、Bメロ、イントロ、ドロップ、間奏、アウトロなど）の開始・終了秒数、およびその区間に並ぶ**コード名 `symbol`**、**度数表記 `roman`**、**各コードの拍数 `beats`**。
   - 転調している区間がある場合は別セクションへ分割し `localKey` を設定する。
3. **既存ファイルを確認する**:
   - `data/index.json` または `data/tracks/` を確認し、同一 `id` のファイルが既にあるか確認する。
   - 既存ファイルがあれば既存の `sections` を維持したまま新セクションを追記または対象セクションを更新し、`updatedAt` を更新する。
   - 新規楽曲なら `data/tracks/<artist-slug>--<track-slug>.json` を新規作成する。
4. **ユーザーの感想と構造化データを記入する**:
   - ユーザーの感想テキストの原文をそのまま `feelingSummary` へ格納する。
   - `feelings` 配列へ雰囲気語彙を入れる。`data/feelings.json` の `canonical` 語彙に一致するものはその表記を優先する。
   - コード進行の聴感上の仕組み（偽終止、セカンダリードミナント、クリシェ、借用和音など）を `cadenceOrMotion` に簡潔にまとめる。
5. **5章のチェックリストを全項目確認してコミットまたはPull Requestを作成する**。GitHub Actionsが自動で `npm run validate:data`、テスト、ビルド、GitHub Pagesデプロイを実行する。

### タスクB: 実現したい雰囲気や度数から作曲用コード進行を検索・提案する

1. `data/index.json` を読み込み、`tracks`（ChordTube実曲）、`feelings` 辞書、および `theory`（`review_status !== "pending"` の承認済み理論レコード）を横断把握する。
2. ユーザーの要望する雰囲気、キーワード、または度数進行に一致する `Section` と、対応する理論パターン・和声テクニックを抽出する。
3. 回答時は必ず以下をセットで提示する。
   - 引用元の楽曲名、アーティスト名、セクション名、ChordTube URL、BPM、Key（理論参照時は `[ID]` と出典URLも併記）
   - 度数進行 `roman` と実音コード `symbol`（拍数付き）
   - なぜその雰囲気になるかの解説 `cadenceOrMotion`（断定せず傾向として説明）
   - ユーザーが指定した目標キーへ移調した場合の実音コード列。さらにWebアプリの「試聴ラボ」へそのまま貼って試聴・`.mid` ダウンロードできる1行形式 `FM7(2) E7(2) Am7(2) Gm7(1) C7(1)` を添える。

### タスクC: 既存コード進行のアレンジ・代理コード案を返す

ユーザーがデータベース内のコード進行をもとに別バリエーションを求めているときは、リポジトリの元データ（ChordTube由来）を上書きせず、`data/theory/harmony-techniques.json` の承認済みテクニック（例: `HARM-001` 二次ドミナント、`HARM-003` トライトーン代理、`HARM-007` 第一転回形ベース進行、`HARM-017` サブドミナントマイナー）を1〜2個だけ選択的に適用し（`RULE-009`）、元進行と対比できる2案程度を（`RULE-004`）チャット上でクイック試聴記法 `コード名(拍数)` で返す。例: `FM7(2) E7(2) Am9(2) Gm7(1) C9(1)`。ユーザーはこの1行をWebアプリの「試聴ラボ」へ貼るだけでピアノ試聴と `.mid` ダウンロードができる。

## 3. ファイル命名規則

- `Track.id` は `<artist-slug>--<track-slug>` 形式。半角小文字英字 `a-z`、数字 `0-9`、ハイフン `-` のみを使用し、アーティスト部と曲名部を `--` で区切る。
- ファイル名は必ず `data/tracks/<Track.id>.json` とする。
- 日本語の曲名・アーティスト名はローマ字または公式英語表記へ変換する。例は `sakanaction--kaiju.json`。

## 4. データスキーマ仕様 (schemaVersion: "2.0")

### 4.1 Track ルートオブジェクト

| フィールド | 型 | 必須 | 制約 |
| --- | --- | --- | --- |
| `schemaVersion` | `"2.0"` | 必須 | 固定文字列 `"2.0"` |
| `id` | `string` | 必須 | `^[a-z0-9-]+--[a-z0-9-]+$`。ファイル名と完全一致 |
| `title` | `string` | 必須 | 1〜200文字 |
| `artist` | `string` | 必須 | 1〜200文字 |
| `source` | `object` | 必須 | `{ "platform": "chordtube", "url": "https://chordtube.net/...", "youtubeId"?: string, "isSample"?: boolean }` |
| `bpm` | `number` | 必須 | 20〜350 |
| `key` | `string` | 必須 | 例は `"C major"`, `"G# minor"`, `"F# minor"` |
| `timeSignature` | `string` | 任意 | `^\d+/\d+$`。既定値は `"4/4"` |
| `releaseYear` | `integer` | 任意 | 1900〜2100 |
| `genres` | `string[]` | 任意 | ジャンルタグ配列 |
| `overallFeelings` | `string[]` | 任意 | 曲全体のフィーリング配列 |
| `notes` | `string` | 任意 | 曲全体の補足メモ |
| `sections` | `Section[]` | 必須 | 1件以上 |
| `createdAt` | `string` | 必須 | タイムゾーン付きISO 8601日時 |
| `updatedAt` | `string` | 必須 | タイムゾーン付きISO 8601日時 |

### 4.2 Section オブジェクト

`theoryAnnotations` は任意の理論分析配列。各注釈は `technique`、`matchType`（`direct` / `partial` / `inference`）、`confidence`、該当箇所、説明、理論レコードID `theoryRefs`、出典 `sources`、コード譜出典 `sourceNote`、留意点 `caveat` を持つ。理論ライブラリとの一致がない場合は `theoryRefs: []` とし、推測で既存IDを付けない。`pending` の理論レコードは必ず確認待ちと明記し、確立した出典として扱わない。

`startBar` / `endBar` は楽曲全体の通し小節番号（1始まり）。AメロとBメロは必ず別Sectionにする。

| フィールド | 型 | 必須 | 制約 |
| --- | --- | --- | --- |
| `id` | `string` | 必須 | 同一 `Track` 内で一意。例は `"sec-01-chorus"` |
| `label` | `enum` | 必須 | `"intro"`, `"verse"`, `"pre_chorus"`, `"chorus"`, `"bridge"`, `"drop"`, `"interlude"`, `"outro"`, `"other"` |
| `displayName` | `string` | 必須 | 例は `"サビ"`, `"Aメロ"`, `"Drop"` |
| `order` | `integer` | 必須 | 1以上の整数 |
| `startSec` / `endSec` | `number` | 任意 | 0以上。両方あるときは `startSec <= endSec` |
| `localKey` | `string` | 任意 | 転調区間のみ指定 |
| `localBpm` | `number` | 任意 | テンポ変化区間のみ指定 |
| `localTimeSignature` | `string` | 任意 | 拍子変化区間のみ指定 |
| `feelings` | `string[]` | 必須 | 1件以上 |
| `feelingSummary` | `string` | 必須 | 1文字以上。ユーザーの感想原文を保持 |
| `chords` | `ChordEvent[]` | 必須 | 1件以上 |
| `cadenceOrMotion` | `string` | 任意 | コード進行の進行感・理論的特徴 |
| `rating` | `integer` | 任意 | 1〜5の整数 |
| `tags` | `string[]` | 任意 | 検索用タグ配列 |

### 4.3 ChordEvent オブジェクトと対応コード記号

`bar` は楽曲全体の小節番号（1始まり）、`beatOffset` は小節内の開始位置を四分音符単位・0始まりで記録する（4/4なら0〜4未満）。`beats` は継続長。

| フィールド | 型 | 必須 | 制約 |
| --- | --- | --- | --- |
| `symbol` | `string` | 必須 | 実音コード名。例: `"C"`, `"Am"`, `"FM7"`, `"Gmaj9"`, `"Dm7"`, `"Bm7b5"`, `"E7"`, `"E7alt"`, `"G/B"`, `"Dsus4"`, `"Cadd9"`, `"F#dim7"`, `"N.C."` |
| `roman` | `string` | 必須 | 度数表記。ChordTube表記に合わせる。例: `"I"`, `"IVM7"`, `"III7"`, `"VIm7"`, `"Vm7"`, `"I7"`, `"V/VII"`, `"bVImaj7"` |
| `beats` | `number` | 必須 | 四分音符を1とした拍数。`0 < beats <= 32`。例: 1小節(4/4)なら `4`、半小節なら `2` |
| `note` | `string` | 任意 | このコードに対する短いメモ |

対応するコード品質表記:
- トライアド: `""`(major), `m`, `min`, `dim`, `aug`, `+`, `sus2`, `sus4`, `5`
- 6th/add9: `6`, `m6`, `6/9`, `add9`, `madd9`
- 7th: `7`, `M7`, `maj7`, `m7`, `mM7`, `mMaj7`, `dim7`, `m7b5`, `7sus4`, `aug7`, `7#5`, `7b5`
- テンション: `9`, `M9`, `maj9`, `m9`, `9sus4`, `11`, `m11`, `maj11`, `13`, `maj13`, `m13`, `7b9`, `7#9`, `7#11`, `7b13`, `7alt`
- オンコード: 末尾に `/ベース音` を付ける。例: `G/B`, `D/F#`, `Am7/G`
- 無音: `N.C.` または `-`

## 5. コミット前の必須チェックリスト

1. `schemaVersion` が `"2.0"` である。
2. `source.platform` が `"chordtube"` であり、`source.url` が `https://chordtube.net/` で始まる実在ページである。
3. 推測で作成したコード進行ではなく、ChordTube上の表示内容に基づいている。
4. ファイル名が `data/tracks/<id>.json` と一致し、`id` が `^[a-z0-9-]+--[a-z0-9-]+$` を満たしている。
5. 各 `Section` に1件以上の `chords` があり、すべての `symbol` が4.3節の対応コード記号である。
6. 各 `ChordEvent.beats` が `0 < beats <= 32` の正数である。
7. `feelings` が1件以上あり、`feelingSummary` にユーザーの感想原文が残っている。
8. `createdAt` と `updatedAt` がタイムゾーン付きISO 8601日時である。
9. リズム・メロディー・手打ちMIDIノート配列のような仕様外フィールドを混ぜていない。
10. 厳密なJSON構文であり、末尾カンマやコメントを含まない。

## 6. 最小構成の記入例

```json
{
  "schemaVersion": "2.0",
  "id": "artist-name--track-name",
  "title": "Track Name",
  "artist": "Artist Name",
  "source": {
    "platform": "chordtube",
    "url": "https://chordtube.net/songs/example"
  },
  "bpm": 124,
  "key": "C major",
  "timeSignature": "4/4",
  "overallFeelings": ["切ない", "スタイリッシュ"],
  "sections": [
    {
      "id": "sec-01-chorus",
      "label": "chorus",
      "displayName": "サビ",
      "order": 1,
      "feelings": ["切ない", "スタイリッシュ"],
      "feelingSummary": "ここにユーザーの感想原文をそのまま入れる。",
      "chords": [
        { "symbol": "FM7", "roman": "IVM7", "beats": 2 },
        { "symbol": "E7", "roman": "III7", "beats": 2 },
        { "symbol": "Am7", "roman": "VIm7", "beats": 2 },
        { "symbol": "Gm7", "roman": "Vm7", "beats": 1 },
        { "symbol": "C7", "roman": "I7", "beats": 1 }
      ],
      "cadenceOrMotion": "IVM7からIII7のセカンダリードミナントでVIm7へ進み、Vm7-I7で次のIVM7へ滑らかに循環する。",
      "rating": 5,
      "tags": ["marusa", "secondary-dominant"]
    }
  ],
  "createdAt": "2026-11-27T06:20:00Z",
  "updatedAt": "2026-11-27T06:20:00Z"
}
```
