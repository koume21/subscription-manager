# @subs/web

サブスク管理アプリのフロントエンド（Next.js App Router）。

```bash
# リポジトリのルートで実行する
pnpm --filter @subs/web dev     # 開発サーバー（http://localhost:3000）
pnpm --filter @subs/web build   # 本番ビルド
pnpm --filter @subs/web lint    # ESLint
```

共通の型・スキーマ・ドメインロジックは `@subs/shared` から import する。
全体の構成は [docs/02_architecture.md](../../docs/02_architecture.md)、画面設計は [docs/08_frontend.md](../../docs/08_frontend.md) を参照。
