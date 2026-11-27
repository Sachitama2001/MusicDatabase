# MusicDatabase

`https://chordtube.net/` で分析された楽曲のコード進行（コード名・度数表記・キー・BPM）とユーザー自身のフィーリングを蓄積し、作曲時に雰囲気や度数から検索して決定論的に正確なピアノ用MIDIを試聴・書き出しするための個人用データベースおよび静的Webアプリケーションです。

## ドキュメント

- [LLM_GUIDE.md](./LLM_GUIDE.md): GitHub接続済みのChatGPTなど、事前コンテキストを持たないLLMがChordTube検索・登録・作曲提案を1ファイルで実行するための運用仕様書
- [DEFINITION.md](./DEFINITION.md): プロジェクトの要件定義書（v2: コード進行特化・ChordTube専用）
- [docs/adr/0001-github-direct-llm-and-static-app.md](./docs/adr/0001-github-direct-llm-and-static-app.md): GitHub直結LLM運用と完全静的Webアプリ構成
- [docs/adr/0002-chordtube-only-and-deterministic-piano-midi.md](./docs/adr/0002-chordtube-only-and-deterministic-piano-midi.md): コード進行特化・ChordTube限定・決定論的Piano MIDI生成への方針転換

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
