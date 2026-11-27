# MusicDatabase

既存楽曲のリズム・メロディー・コードに対するフィーリングを記録し、作曲時に雰囲気から構成要素を検索・試聴・MIDI書き出しするための個人用データベースおよび静的Webアプリケーションです。

## ドキュメント

- [LLM_GUIDE.md](./LLM_GUIDE.md): GitHub接続済みのChatGPTなど、事前コンテキストを持たないLLMがデータ登録・提案・MIDI生成を1ファイルで実行するための運用・スキーマ仕様書
- [DEFINITION.md](./DEFINITION.md): プロジェクトの要件定義書
- [docs/adr/0001-github-direct-llm-and-static-app.md](./docs/adr/0001-github-direct-llm-and-static-app.md): 設計判断記録

## コマンド

```bash
npm install
npm run validate:data   # data/ 配下の全JSONのスキーマと不変条件を検証
npm run build:index     # data/index.json と public/data/index.json を生成
npm run dev             # ローカル開発サーバーを起動
npm run typecheck       # TypeScript型チェック
npm run test            # Vitestユニットテストを実行
npm run build           # 検証・インデックス生成・GitHub Pages向け静的ビルド
```

## GitHub Pages 公開手順

1. リポジトリの Settings > Pages で Source に **GitHub Actions** を選択する。
2. `main` ブランチへプッシュすると `.github/workflows/deploy-pages.yml` が自動で検証・ビルド・公開を実行する。
