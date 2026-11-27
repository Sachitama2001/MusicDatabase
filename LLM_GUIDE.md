# LLM_GUIDE.md — MusicDatabase 運用・データ仕様書

この文書は、事前の会話履歴を持たないLLMが、GitHub連携を通じて `MusicDatabase` リポジトリの読み取り、楽曲分析データの登録・更新、作曲向け構成要素の提案、およびMIDIデータの生成・微調整を1ファイルだけで正確に実行するための仕様書である。

## 1. リポジトリの目的と全体構成

`MusicDatabase` は、個人専用の楽曲分析データベースである。ユーザーは既存楽曲の「リズム」「メロディー」「コード」の3要素に対して自身が感じたフィーリングを記録し、DAWであるFender Studio ProでMIDI打ち込みを行う際に、実現したい雰囲気から構成要素を検索・参照・MIDI化するために使用する。

- データの登録、更新、フィーリングからの提案、MIDI生成と微調整は、GitHubに接続されたLLMが直接行う。
- GitHub Pages上で公開される静的Webアプリは、`data/index.json` を読み込み、オフライン検索、ブラウザ上でのMIDI再生と移調試聴、`.mid` ファイルと `MidiClip` JSONの相互変換を担う。

### ディレクトリと編集権限

| パス | 役割 | LLMによる直接編集 |
| --- | --- | --- |
| `data/tracks/<track-id>.json` | 楽曲ごとの分析データの正本。1楽曲につき1ファイル | 可。新規作成および更新の主対象 |
| `data/feelings.json` | フィーリング語彙と同義語の正規化辞書 | 可。新しい頻出語彙や同義語を追加するときに更新 |
| `data/index.json` | 全楽曲の集約インデックス。全曲俯瞰の読み取りに使用 | 不可。CIまたは `npm run build:index` が自動生成する |
| `src/` `scripts/` | Webアプリと検証スクリプトのソースコード | ユーザーから明示的な改修指示があるときのみ可 |
| `DEFINITION.md` | 要件定義書 | 仕様変更の指示があるときのみ可 |

### 禁止事項

- 商用楽曲の音声ファイル、歌詞全文、市販スコア画像をリポジトリへ追加しない。
- APIキーやアクセストークンのような秘密情報をリポジトリへ書き込まない。
- `data/tracks/` 配下のファイル名と JSON 内の `id` を不一致にしない。

## 2. タスク別の実行手順

ユーザーからの依頼内容に応じて、次の4つの手順のいずれかを実行する。

### タスクA: ユーザーの感想テキストから楽曲を登録または更新する

1. まず `data/index.json` または `data/tracks/` を確認し、対象楽曲と同一の `id` のファイルが既に存在するかを調べる。
2. ファイルが存在しない場合は `data/tracks/<artist-slug>--<track-slug>.json` を新規作成する。既に存在する場合は該当ファイルを読み込み、既存の `sections` を保ったまま新しい `Section` を追加するか、対象セクションを更新し、`updatedAt` を現在時刻のISO 8601形式へ更新する。
3. ユーザーの感想文の原文は改変せず、そのまま対象セクションの `feelingSummary` に格納する。
4. 感想文およびユーザーが提示したコード進行・URL・楽曲情報から、次の項目を構造化する。
   - `feelings`: 感情や雰囲気を表す短い語彙配列。`data/feelings.json` の `canonical` 語彙に一致するものは極力その表記を優先し、新しい表現もそのまま入れてよい。
   - `rhythm`: テンポ感の `feel`、グルーヴ説明、ドラムとベースの特徴。
   - `melody`: スケールやモード、輪郭、フックの特徴。
   - `harmony`: 実音コード配列 `chordProgression` と、移調して作曲へ流用するための度数表記配列 `romanNumerals`、終止感や動きの説明。
5. ユーザーが参考となるコード進行やリズムパターンを再現したMIDI断片を希望したとき、または十分に具体的な情報があるときは、`midiClips` に4小節から8小節程度の `piano`、`bass`、`drum` リファレンスパターンを添付する。
6. 5章のチェックリストをすべて確認したうえでファイルを保存・コミットまたはPull Requestを作成する。GitHub Actionsが自動で `npm run validate:data` と `npm run build` を実行する。

### タスクB: 実現したい雰囲気から作曲構成要素を検索・提案する

1. `data/index.json` を読み込み、全 `tracks` と `feelings` 辞書を把握する。
2. ユーザーの要望する雰囲気に一致または近接する `Section` を、`feelings`、`feelingSummary`、`rhythm`、`melody`、`harmony`、`tags` から抽出する。
3. 提案時は必ず以下の4点をセットで返す。
   - 引用元の楽曲名、アーティスト名、セクション名、BPM、Key
   - そのままDAWで試せる度数表記 `romanNumerals` と実音コード例
   - リズムの組み立て方とドラム・ベースの具体案
   - メロディーのスケール選択と音程の動き方

### タスクC: テキスト指示から `bass`・`piano`・`drum` の `MidiClip` JSONを生成する

1. ユーザーが指定した雰囲気、BPM、Key、拍子、小節数、および参照すべき `Section` を確認する。指定がない場合は `bpm: 120`, `timeSignature: "4/4"`, `bars: 4` を既定値とする。
2. 4.5節の `MidiClip` スキーマに厳密に従ったJSONを生成する。
3. トラックの役割は `piano`、`bass`、`drum` の3種類のみを使用する。
   - `piano`: `channel: 0`, `program: 0`。コードボイシングやトップメロディーを MIDIノート番号 48〜84 の範囲を中心に配置する。
   - `bass`: `channel: 1`, `program: 33`。ルートと経過音を MIDIノート番号 28〜55 の範囲を中心に配置する。
   - `drum`: `channel: 9`、GM配列の10チャンネル相当。4.6節のGMドラムノート番号を使用する。
4. ユーザーへ回答する際は、Webアプリの「MIDIスタジオ」へそのまま貼り付けて試聴および `.mid` ダウンロードできるよう、単一のコードブロックで完全な `MidiClip` JSONを出力する。リポジトリの該当セクションへの保存も求められた場合は `midiClips` 配列へ追記する。

### タスクD: ユーザーから渡された `MidiClip` JSONを微調整する

1. ユーザーはWebアプリの「MIDIスタジオ」で `.mid` を `MidiClip` JSONへ変換して貼り付けてくる。
2. 入力された `MidiClip` の `bpm`、`timeSignature`、`bars`、および変更指示の対象外であるトラックのノートを無断で削除・改変しない。
3. 指示されたトラックや小節範囲に対してのみ、データベース内の参照セクションの技法を適用してノートを修正する。
4. 変更点の概要を簡潔に説明したうえで、Webアプリの「変更後JSON」欄へそのまま貼り付けられる完全な `MidiClip` JSONを出力する。

## 3. ファイル命名規則

- `Track.id` は `<artist-slug>--<track-slug>` の形式とする。
- 使用できる文字は半角小文字英字 `a-z`、半角数字 `0-9`、ハイフン `-` のみとし、アーティスト部と曲名部を二重ハイフン `--` で区切る。
- ファイル名は必ず `data/tracks/<Track.id>.json` とする。
- 日本語のアーティスト名や曲名はローマ字または英語表記へ変換する。例は `yoasobi--yoru-ni-kakeru.json` である。
- 同一楽曲の別バージョン、カバー、ライブ版は末尾へハイフン付きで識別子を付ける。例は `polyphia--yas-live-2023.json` とし、原曲と同じ `workId` を設定する。

## 4. データスキーマ仕様

すべてのデータファイルは `src/schema/` のZodスキーマで厳格に検証される。

### 4.1 Track ルートオブジェクト

| フィールド | 型 | 必須 | 制約とルール |
| --- | --- | --- | --- |
| `schemaVersion` | `"1.0"` | 必須 | 固定文字列 `"1.0"` |
| `id` | `string` | 必須 | 正規表現 `^[a-z0-9-]+--[a-z0-9-]+$`。ファイル名と完全一致 |
| `title` | `string` | 必須 | 1〜200文字 |
| `artist` | `string` | 必須 | 1〜200文字 |
| `workId` | `string` | 任意 | 原曲とアレンジを束ねる共通ID |
| `versionType` | `enum` | 任意 | `"original"`, `"arrangement"`, `"cover"`, `"remix"`, `"live"`, `"other"`。既定値は `"original"` |
| `composers` | `string[]` | 任意 | 作曲者名配列 |
| `arrangers` | `string[]` | 任意 | 編曲者名配列 |
| `releaseYear` | `integer` | 任意 | 1900〜2100 |
| `bpm` | `number` | 任意 | 20〜350 |
| `key` | `string` | 任意 | 例は `"F# minor"`, `"C major"`, `"D Dorian"` |
| `timeSignature` | `string` | 任意 | 正規表現 `^\d+/\d+$`。例は `"4/4"`, `"6/8"` |
| `durationSec` | `number` | 任意 | 0より大きい秒数 |
| `genres` | `string[]` | 任意 | ジャンルタグ配列 |
| `overallFeelings` | `string[]` | 任意 | 楽曲全体のフィーリング配列 |
| `references` | `ReferenceLink[]` | 任意 | `{ kind, url, label }` の配列。`kind` は `"youtube"`, `"spotify"`, `"chords"`, `"score"`, `"other"` |
| `localAudioHint` | `string` | 任意 | ローカル音源メモ。バイナリ自体は置かない |
| `notes` | `string` | 任意 | 楽曲全体の補足メモ |
| `sections` | `Section[]` | 必須 | 1件以上 |
| `createdAt` | `string` | 必須 | タイムゾーン付きISO 8601日時。例は `"2026-11-27T05:45:00Z"` |
| `updatedAt` | `string` | 必須 | タイムゾーン付きISO 8601日時 |

### 4.2 Section オブジェクト

| フィールド | 型 | 必須 | 制約とルール |
| --- | --- | --- | --- |
| `id` | `string` | 必須 | 同一 `Track` 内で一意。例は `"sec-01-drop"` |
| `label` | `enum` | 必須 | `"intro"`, `"verse"`, `"pre_chorus"`, `"chorus"`, `"bridge"`, `"drop"`, `"solo"`, `"interlude"`, `"outro"`, `"other"` |
| `displayName` | `string` | 必須 | 表示名。例は `"Drop"`, `"Aメロ"`, `"サビ"` |
| `order` | `integer` | 必須 | 1以上の整数 |
| `startBar` / `endBar` | `integer` | 任意 | 1以上。両方あるときは `startBar <= endBar` |
| `startSec` / `endSec` | `number` | 任意 | 0以上。両方あるときは `startSec <= endSec` |
| `localBpm` | `number` | 任意 | 転調・テンポ変化時のみ指定。20〜350 |
| `localKey` | `string` | 任意 | 転調時のみ指定 |
| `localTimeSignature` | `string` | 任意 | 拍子変化時のみ指定。`^\d+/\d+$` |
| `feelings` | `string[]` | 必須 | 1件以上 |
| `feelingSummary` | `string` | 必須 | 1文字以上。ユーザーの感想原文を保持する |
| `rhythm` | `RhythmElement` | 任意 | 3要素のうち最低1つは非空にする |
| `melody` | `MelodyElement` | 任意 | 3要素のうち最低1つは非空にする |
| `harmony` | `HarmonyElement` | 任意 | 3要素のうち最低1つは非空にする |
| `instruments` | `string[]` | 任意 | 目立つ楽器編成 |
| `rating` | `integer` | 任意 | 1〜5の整数 |
| `tags` | `string[]` | 任意 | 検索用タグ配列 |
| `midiClips` | `MidiClip[]` | 任意 | 同一セクション内で `id` が一意であること |

### 4.3 音楽3要素オブジェクト

- **`rhythm`**:
  - `feel`: `"straight"`, `"half-time"`, `"double-time"`, `"shuffle"`, `"swing"`, `"syncopated"`, `"polyrhythm"`, `"other"` のいずれか
  - `grooveDescription`: `string`
  - `drumNotes`: `string`
  - `bassNotes`: `string`
  - `tags`: `string[]`
- **`melody`**:
  - `scaleOrMode`: `string`
  - `contour`: `string`
  - `hookDescription`: `string`
  - `register`: `string`
  - `tags`: `string[]`
- **`harmony`**:
  - `chordProgression`: `string[]` 実音コード進行。例は `["C#7alt", "Dmaj9", "C#m7", "Bm9"]`
  - `romanNumerals`: `string[]` 度数表記。例は `["V7alt", "bVImaj9", "v7", "iv9"]`
  - `cadenceOrMotion`: `string`
  - `voicingNotes`: `string`
  - `modulationNotes`: `string`
  - `tags`: `string[]`

### 4.4 FeelingLexicon オブジェクト

`data/feelings.json` は `schemaVersion: "1.0"` と `entries` 配列を持つ。各エントリは `{ canonical, synonyms, category?, description? }` とし、`canonical` は大文字小文字を区別せず一意とする。

### 4.5 MidiClip オブジェクト

| フィールド | 型 | 必須 | 制約とルール |
| --- | --- | --- | --- |
| `id` | `string` | 必須 | 1〜120文字 |
| `name` | `string` | 必須 | 1〜200文字 |
| `bpm` | `number` | 必須 | 20〜350 |
| `key` | `string` | 任意 | 基準キー |
| `timeSignature` | `string` | 必須 | 例は `"4/4"` |
| `bars` | `integer` | 必須 | 1〜64の整数 |
| `tracks` | `MidiTrackData[]` | 必須 | 1件以上 |

`MidiTrackData` の各要素:
- `role`: `"piano"`, `"bass"`, `"drum"` のいずれか
- `program`: 0〜127の整数、任意。既定値は `piano: 0`, `bass: 33`
- `channel`: 0〜15の整数、任意。既定値は `piano: 0`, `bass: 1`, `drum: 9`
- `notes`: `{ midi, startBeat, durationBeats, velocity }[]`
  - `midi`: 0〜127の整数。例としてC4は60、A4は69
  - `startBeat`: 0以上の数値。0始まりの四分音符単位。4/4拍子で4小節なら `0` から `16` 未満
  - `durationBeats`: 0より大きい数値。四分音符は `1.0`、八分音符は `0.5`、十六分音符は `0.25`
  - `velocity`: `0 < velocity <= 1.0` の小数

### 4.6 GMドラム標準ノート番号の対応

`role: "drum"` のトラックでは次のMIDIノート番号を使用する。

| MIDI番号 | 楽器 |
| --- | --- |
| 36 | Bass Drum 1 / Kick |
| 38 | Acoustic Snare |
| 39 | Hand Clap |
| 42 | Closed Hi-Hat |
| 44 | Pedal Hi-Hat |
| 46 | Open Hi-Hat |
| 49 | Crash Cymbal 1 |
| 51 | Ride Cymbal 1 |

## 5. コミット・出力前の必須チェックリスト

LLMはファイルをコミットする前、またはJSONをユーザーへ返す前に、次の10項目を必ず確認する。

1. `schemaVersion` が `"1.0"` である。
2. ファイル名が `data/tracks/<id>.json` と完全一致している。
3. `id` が `^[a-z0-9-]+--[a-z0-9-]+$` を満たし、既存ファイルと重複していない。
4. `sections` が1件以上あり、同一 `Track` 内で `section.id` が重複していない。
5. 各 `Section` で `rhythm`、`melody`、`harmony` のうち少なくとも1つに内容が入っている。
6. `feelings` が1件以上あり、`feelingSummary` にユーザーの感想原文が残っている。
7. `startBar <= endBar` および `startSec <= endSec` を満たしている。
8. `createdAt` と `updatedAt` がタイムゾーン付きのISO 8601文字列である。例は `"2026-11-27T05:45:00Z"` である。
9. `MidiClip` を含む場合、`role` は `"piano"`, `"bass"`, `"drum"` のみで、`midi` は0〜127整数、`startBeat >= 0`、`durationBeats > 0`、`0 < velocity <= 1` をすべて満たしている。
10. JSONに末尾カンマやコメントが含まれておらず、厳密なJSONとして解析できる。

## 6. 最小構成の記入例

### 6.1 Track JSON テンプレート

```json
{
  "schemaVersion": "1.0",
  "id": "artist-name--track-name",
  "title": "Track Name",
  "artist": "Artist Name",
  "versionType": "original",
  "bpm": 128,
  "key": "C major",
  "timeSignature": "4/4",
  "overallFeelings": ["切ない", "浮遊感"],
  "sections": [
    {
      "id": "sec-01-chorus",
      "label": "chorus",
      "displayName": "サビ",
      "order": 1,
      "feelings": ["切ない", "高揚感"],
      "feelingSummary": "ここにユーザーの感想原文をそのまま残す。",
      "rhythm": {
        "feel": "straight",
        "grooveDescription": "4つ打ちキックと裏拍ハイハットで前へ推進する。"
      },
      "harmony": {
        "chordProgression": ["Fmaj7", "G6", "Em7", "Am9"],
        "romanNumerals": ["IVmaj7", "V6", "iii7", "vi9"],
        "cadenceOrMotion": "王道進行に9thを加えて透明感と切なさを出す。"
      }
    }
  ],
  "createdAt": "2026-11-27T06:00:00Z",
  "updatedAt": "2026-11-27T06:00:00Z"
}
```

### 6.2 MidiClip JSON テンプレート

```json
{
  "id": "clip-sample-4bars",
  "name": "Emotional 4-bar Loop",
  "bpm": 120,
  "key": "C major",
  "timeSignature": "4/4",
  "bars": 4,
  "tracks": [
    {
      "role": "piano",
      "program": 0,
      "channel": 0,
      "notes": [
        { "midi": 65, "startBeat": 0, "durationBeats": 4, "velocity": 0.75 },
        { "midi": 69, "startBeat": 0, "durationBeats": 4, "velocity": 0.7 },
        { "midi": 72, "startBeat": 0, "durationBeats": 4, "velocity": 0.7 },
        { "midi": 76, "startBeat": 0, "durationBeats": 4, "velocity": 0.72 }
      ]
    },
    {
      "role": "bass",
      "program": 33,
      "channel": 1,
      "notes": [
        { "midi": 41, "startBeat": 0, "durationBeats": 3.5, "velocity": 0.85 }
      ]
    },
    {
      "role": "drum",
      "channel": 9,
      "notes": [
        { "midi": 36, "startBeat": 0, "durationBeats": 0.5, "velocity": 0.92 },
        { "midi": 38, "startBeat": 2, "durationBeats": 0.5, "velocity": 0.9 }
      ]
    }
  ]
}
```
