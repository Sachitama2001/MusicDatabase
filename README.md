# MusicDatabase

<https://sachitama2001.github.io/MusicDatabase/>

**[MusicDatabase アプリケーションを開く](https://sachitama2001.github.io/MusicDatabase/)**

上のリンクから、インストール不要でブラウザ上のアプリを利用できます。GitHub Pagesで公開している静的Webアプリです。

`https://chordtube.net/` で分析された楽曲のコード進行（コード名・度数表記・キー・BPM）とユーザー自身のフィーリングを蓄積し、作曲時に雰囲気や度数から検索して決定論的に正確なピアノ用MIDIを試聴・書き出しするための個人用データベースおよび静的Webアプリケーションです。

## アプリの使い方

1. **[MusicDatabaseを開く](https://sachitama2001.github.io/MusicDatabase/)**。
2. 起動後、画面上部のタブから目的の機能を選びます。
   - **検索・発見**：楽曲・コード進行・フィーリングから登録済み楽曲を検索
   - **楽曲詳細・MIDI試聴**：楽曲のセクションとコード進行を確認し、ピアノ試聴やMIDI書き出し
   - **音楽理論ライブラリ**：理論コード進行、和声テクニック、スタイル・ムード、作曲原則を検索・試聴
   - **試聴ラボ・検証・LLMガイド**：コード進行を入力して試聴・検証し、LLM向けガイドを確認
3. コード進行を試聴するときは、各セクションの試聴機能または試聴ラボを利用します。必要に応じてキーやテンポを調整し、MIDIを書き出してください。

### アプリが開かないとき

- 数分待ってから再読み込みしてください。GitHub Pagesのデプロイ直後は反映に時間がかかる場合があります。
- [GitHub Actionsの実行状況](https://github.com/Sachitama2001/MusicDatabase/actions)を開き、最新の **Deploy GitHub Pages** が `success` になっているか確認してください。
- アプリのデータはリポジトリ内のJSONからビルドされます。データ更新後はGitHub Actionsの完了を待ってから再読み込みしてください。

## ドキュメント

- [LLM_GUIDE.md](./LLM_GUIDE.md): GitHub接続済みのChatGPTなど、事前コンテキストを持たないLLMがChordTube検索・登録・作曲提案を1ファイルで実行するための運用仕様書
- [DEFINITION.md](./DEFINITION.md): プロジェクトの要件定義書（v2: コード進行特化・ChordTube専用）
- [docs/adr/0001-github-direct-llm-and-static-app.md](./docs/adr/0001-github-direct-llm-and-static-app.md): GitHub直結LLM運用と完全静的Webアプリ構成
- [docs/adr/0002-chordtube-only-and-deterministic-piano-midi.md](./docs/adr/0002-chordtube-only-and-deterministic-piano-midi.md): コード進行特化・ChordTube限定・決定論的Piano MIDI生成への方針転換
- [docs/adr/0003-integrate-musictheory-knowledge-base.md](./docs/adr/0003-integrate-musictheory-knowledge-base.md): MusicTheoryの音楽理論知識ベースの統合方針
- [docs/SOURCES.md](./docs/SOURCES.md): 音楽理論・和声・知覚研究の出典レジストリ

## コマンド

```bash
npm install
npm run validate:data   # data/ 配下の全JSONのスキーマ・ChordTube URL・コード記号パースを検証
npm run build:index     # data/index.json と public/data/index.json を生成
npm run dev             # ローカル開発サーバーを起動
npm run typecheck       # TypeScript型チェック
npm run test            # Vitestユニットテストを実行
npm run build           # 検証・インデックス生成・GitHub Pages向け静的ビルド
```

## GitHub Pages 公開手順

1. リポジトリの **Settings** > **Pages** で **Source** に **GitHub Actions** を選択する。
2. `main` ブランチへプッシュすると `.github/workflows/deploy-pages.yml` が自動で検証・ビルド・公開を実行する。
3. 公開後は上部の **MusicDatabase アプリケーションを開く** リンクからアクセスする。
