# サブスク管理アプリ 設計書（目次）

自分が契約している月単位・年単位のサブスクリプションを一元管理・可視化し、
**更新日が近づいたらメールで通知する（解約忘れ防止）** Web アプリの設計書一式。

> 本アプリは開発練習用。設計フェーズ（要件定義〜運用設計）をすべて文書化する。
> 構想メモの「余力があれば」（多通貨・為替、支出予測・集計分析）は **本設計のスコープ外**。

## ドキュメント一覧

| # | ファイル | 内容 |
|---|---|---|
| 0 | [00_gap_analysis.md](00_gap_analysis.md) | 構想メモの「穴」の洗い出しと、本設計での決定事項 |
| 1 | [01_requirements.md](01_requirements.md) | 要件定義（機能要件・非機能要件・スコープ外） |
| 2 | [02_architecture.md](02_architecture.md) | システム構成・技術選定・ADR（BullMQ vs pg-boss 等） |
| 3 | [03_domain_logic.md](03_domain_logic.md) | ドメインルール（更新日計算・金額換算・状態遷移） |
| 4 | [04_database.md](04_database.md) | DB 設計（ER 図・テーブル定義・インデックス・Prisma スキーマ） |
| 5 | [05_api.md](05_api.md) | REST API 設計（エンドポイント・入出力・ステータスコード） |
| 6 | [06_auth_security.md](06_auth_security.md) | 認証・認可・セキュリティ設計 |
| 7 | [07_reminder_jobs.md](07_reminder_jobs.md) | **主役**：更新リマインダー／非同期ジョブ／冪等性設計 |
| 8 | [08_frontend.md](08_frontend.md) | 画面設計・画面遷移・可視化 |
| 9 | [09_operations.md](09_operations.md) | 開発環境・テスト・CI/CD・デプロイ・監視 |
| 10 | [10_roadmap.md](10_roadmap.md) | 実装マイルストーン |
| 11 | [11_setup.md](11_setup.md) | 開発環境構築手順（Windows 11） |

## 確定した技術選定（サマリ）

| 項目 | 採用 | 備考 |
|---|---|---|
| 言語 | TypeScript | フロント・バック・ワーカーで共通 |
| フロント | Next.js (App Router) + React | |
| バックエンド | Node.js + Express | API サーバーとジョブワーカーは別プロセス |
| DB | PostgreSQL | |
| ORM | Prisma | |
| ジョブキュー | **BullMQ + Redis**（採用） / pg-boss（比較対象） | 比較は [02_architecture.md](02_architecture.md#adr-002-ジョブキュー) |
| API 方式 | REST（+ OpenAPI） | 理由は ADR-001 |
| 認証 | メール + パスワード、サーバーサイドセッション（Cookie） | argon2id でハッシュ化 |
| メール送信 | Resend（本番）／ Mailpit（開発） | Idempotency-Key 対応が決め手 |
| デプロイ | Render（Railway でも同構成で可） | Web / API / Worker / Postgres / Redis |

## 用語

| 用語 | 意味 |
|---|---|
| サブスク | ユーザーが登録する 1 件の契約（例：Netflix） |
| 請求サイクル | 「1 か月ごと」「1 年ごと」など課金の周期 |
| 起算日（アンカー日） | 請求サイクルの基準となる日。更新日はすべてこの日から計算する |
| 次回更新日 | 次に課金・自動更新される日 |
| リマインダー | 「次回更新日の N 日前」に送る通知 1 通分のレコード |
| オフセット | リマインダーを更新日の何日前に送るか（0 = 当日） |

## 2. リポジトリ構成（pnpm workspaces の monorepo）

```
subscription-manager/
├─ apps/
│  ├─ web/                 # Next.js
│  │  └─ src/app/...
│  └─ server/              # Express API と Worker（エントリーポイントを分ける）
│     ├─ src/
│     │  ├─ api.ts         # API サーバー起動
│     │  ├─ worker.ts      # ワーカー起動
│     │  ├─ routes/        # ルーティング（HTTP 層）
│     │  ├─ services/      # ユースケース（業務ロジック）
│     │  ├─ jobs/          # ジョブ定義・プロセッサ
│     │  ├─ mail/          # メールテンプレート・送信アダプタ
│     │  ├─ lib/           # prisma, redis, logger, config
│     │  └─ middlewares/   # 認証・エラーハンドリング・レート制限
│     ├─ prisma/
│     │  ├─ schema.prisma
│     │  └─ migrations/
│     └─ test/
├─ packages/
│  └─ shared/              # web と server で共有
│     ├─ schemas/          # zod スキーマ・API 型・定数
│     └─ domain/           # 純粋関数（更新日計算・金額換算・リマインダー計画）※DB 非依存
├─ docker-compose.yml      # postgres, redis, mailpit
└─ .github/workflows/ci.yml
```