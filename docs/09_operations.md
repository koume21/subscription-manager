# 09. 開発環境・テスト・デプロイ・運用

## 1. ローカル開発環境

### 1.1 docker-compose.yml（ミドルウェアのみコンテナ、アプリはホストで実行）

```yaml
services:
  postgres:
    image: postgres:16
    environment:
      POSTGRES_USER: app
      POSTGRES_PASSWORD: app
      POSTGRES_DB: subscriptions
    ports: ["5432:5432"]
    volumes: [pgdata:/var/lib/postgresql/data]

  redis:
    image: redis:7
    command: ["redis-server", "--maxmemory-policy", "noeviction"]  # BullMQ の必須設定
    ports: ["6379:6379"]

  mailpit:                       # 開発用 SMTP。送信メールを Web UI で確認できる
    image: axllent/mailpit
    ports: ["1025:1025", "8025:8025"]

volumes:
  pgdata:
```

### 1.2 起動手順

> 初回の環境構築（ツールのインストール・プロジェクト作成）は [11_setup.md](11_setup.md) を参照。

```bash
pnpm install
docker compose up -d
pnpm --filter @subs/server db:migrate
pnpm --filter @subs/server db:seed   # テストユーザー・サンプルサブスク投入
pnpm dev                          # web / api / worker を並列起動
```

- メール確認：http://localhost:8025（Mailpit）
- ジョブ確認：http://localhost:4000/admin/queues（Bull Board）

### 1.3 環境変数

| 変数 | 用途 | 例（開発） |
|---|---|---|
| `NODE_ENV` | | development |
| `APP_URL` | メール内リンク・Origin 検証 | http://localhost:3000 |
| `API_INTERNAL_URL` | Next.js rewrites の転送先 | http://localhost:4000 |
| `DATABASE_URL` | | postgresql://app:app@localhost:5432/subscriptions |
| `REDIS_URL` | | redis://localhost:6379 |
| `MAIL_DRIVER` | `smtp` \| `resend` | smtp |
| `SMTP_URL` | Mailpit | smtp://localhost:1025 |
| `RESEND_API_KEY` | 本番のみ | （秘密） |
| `MAIL_FROM` | | サブスク管理 <noreply@example.com> |
| `UNSUBSCRIBE_SECRET` | 配信停止トークンの HMAC 鍵（32 バイト以上） | （秘密） |
| `ENABLE_BULL_BOARD` | | true |
| `BULL_BOARD_USER` / `BULL_BOARD_PASSWORD` | | （秘密） |
| `LOG_LEVEL` | | debug |
| `TZ` | プロセスのタイムゾーン | UTC |

起動時に zod で検証し、欠落・不正なら即終了する（`lib/config.ts`）。`.env.example` をリポジトリに置く。

## 2. テスト戦略

| レベル | ツール | 対象 | 重点 |
|---|---|---|---|
| ユニット | Vitest | `domain/`（更新日計算、金額換算、リマインダー計画） | **最重点**。月末・うるう年・TZ・境界値を網羅 |
| 統合（API） | Vitest ＋ Supertest ＋ 実 Postgres | 各エンドポイント | 認可（他人のリソース 404）、バリデーション、ステータスコード |
| 統合（ジョブ） | Vitest ＋ 実 Postgres ＋ 実 Redis ＋ モック MailSender | scan / send / advance | **冪等性**（同じジョブ 2 回実行で 1 通、ワーカー 2 並列で 1 通、送信後クラッシュ再現） |
| E2E | Playwright | サインアップ→認証→登録→ダッシュボード | ハッピーパスのみ最小限 |

### 2.1 必須テストケース（抜粋）

**更新日計算**
- 1/31 起算・月次 → 2/28, 3/31, 4/30
- 2/29 起算・年次 → 平年 2/28、うるう年 2/29
- 更新日当日は繰り上がらない、翌日に繰り上がる
- 起算日が未来 → 起算日そのものが次回更新日
- 長期間（数年）経過後でも正しいサイクルへ進む

**リマインダー計画**
- 7 日・1 日前、TZ=Asia/Tokyo、9 時 → 正しい UTC 時刻
- TZ=America/New_York のサマータイム切替日
- 全オフセットが過去・更新日が未来 → 直近 1 通を即時
- 更新日も過去 → 生成しない

**冪等性**
- `regenerateReminders` を 2 回呼んでも行数が変わらない
- SENT 済みの (renewal_date, offset) は再生成されない
- 同じ reminderId のジョブを 2 回処理 → `MailSender.send` は 1 回
- MailSender 成功後・DB 更新前に例外 → リトライで同じ Idempotency-Key が使われる
- scan を 2 並列実行 → 各リマインダーは 1 回だけキュー投入
- キュー投入後に解約 → SKIPPED、送信されない

**認証・認可**
- 他ユーザーのサブスクへの GET/PATCH/DELETE/cancel → 404
- Origin なし・他オリジンの POST → 403
- パスワードリセット後、旧セッションで 401
- 期限切れ・使用済みトークン → 400

### 2.2 テストの工夫
- 時刻は `now` を引数で注入（`vi.useFakeTimers` より明示的）
- テスト DB はテストファイルごとにトランザクションで巻き戻す or スキーマを分ける
- メール送信は `MailSender` のインメモリ実装を DI

## 3. CI（GitHub Actions）

```yaml
# .github/workflows/ci.yml（概要）
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    services:
      postgres: { image: postgres:16, env: {...}, ports: ["5432:5432"] }
      redis:    { image: redis:7, ports: ["6379:6379"] }
    steps:
      - checkout / setup-node / pnpm install --frozen-lockfile
      - pnpm lint
      - pnpm typecheck
      - pnpm --filter server prisma migrate deploy
      - pnpm test
      - pnpm build
```

- main ブランチ保護：CI 成功必須
- Dependabot：週次

## 4. デプロイ（Render）

### 4.1 構成

| Render サービス | 種別 | 内容 | 開始/ビルドコマンド |
|---|---|---|---|
| `subs-web` | Web Service | Next.js | `pnpm --filter web build` / `pnpm --filter web start` |
| `subs-api` | Web Service（または Private Service） | Express API | `pnpm --filter server build` / `node dist/api.js` |
| `subs-worker` | Background Worker | BullMQ ワーカー | 同上 / `node dist/worker.js` |
| `subs-db` | PostgreSQL | | |
| `subs-redis` | Key Value（Redis 互換） | **maxmemory-policy を `noeviction` に設定** | |

- `subs-api` の Pre-Deploy Command：`pnpm --filter server prisma migrate deploy`（マイグレーションはここだけで実行。worker では実行しない）
- `subs-web` の `API_INTERNAL_URL` に `subs-api` の内部 URL を設定（rewrites 先）
- 構成は `render.yaml`（Blueprint）でコード化する
- ヘルスチェックパス：web `/`、api `/healthz`

### 4.2 注意点（プラン・料金）

- 無料プランの Web Service は無アクセス時にスリープする。**Background Worker と定期実行のためには有料インスタンスが必要** になる可能性が高い。また無料 Postgres には利用期限がある
- プラン・料金は変わるため、着手時に公式ページで確認する。費用を抑えたい場合は Railway（従量課金）でも同じ構成（web / api / worker / Postgres / Redis）が組める
- Redis の退避ポリシーが `noeviction` 以外だと、メモリ逼迫時に BullMQ のジョブデータが消えてキューが壊れる

### 4.3 メール送信ドメイン

- Resend で独自ドメインを登録し、DNS に SPF・DKIM・DMARC（`p=none` から開始）レコードを設定
- ドメインがない間は Resend の制限（自分宛のみ送信可など）の範囲でテストする

### 4.4 マイグレーション方針

- 破壊的変更（カラム削除・リネーム）は **2 段階**（①新カラム追加＆両方書き込み → ②旧カラム削除）で行い、デプロイ中の旧バージョンを壊さない
- api と worker は同じコードベースからビルドし、同時にデプロイする

## 5. 監視・ログ

| 項目 | 方法 |
|---|---|
| アプリログ | pino の JSON を標準出力 → Render のログ画面 |
| 必須フィールド | `level`, `time`, `msg`, `requestId`（API）, `jobName` / `jobId`（ワーカー）, `userId`（あれば） |
| マスキング | `password`, `token`, `cookie`, `authorization` を redact |
| 死活監視 | `/healthz`（Render のヘルスチェック）、外部監視（UptimeRobot 等）で `/readyz` |
| エラー通知 | 任意で Sentry（無料枠）を api / worker / web に導入 |
| ジョブ監視 | Bull Board（本番は既定で無効）、scan ジョブの遅延件数 WARN ログ |

## 6. バックアップ・障害対応

| 事象 | 影響 | 対応 |
|---|---|---|
| Worker 停止 | 通知が遅れる | 再起動で scan が未処理分を拾い直す。更新日を過ぎたものは送らない（EXPIRED） |
| Redis のデータ消失 | キュー内ジョブ消失 | DB が正なので、QUEUED の取り残し回収（30 分）と PENDING の scan で自動回復。定期ジョブは worker 起動時に再登録 |
| Postgres 障害 | 全機能停止 | マネージドのバックアップから復元（プランのバックアップ機能を確認） |
| Resend 障害 | 送信遅延 | 最大 5 回・約 31 分リトライ。それ以上は FAILED → 必要なら手動で PENDING に戻して再送（管理用スクリプト `scripts/retry-failed-reminders.ts` を用意） |
| 秘密情報漏えい | | `RESEND_API_KEY` 再発行、`UNSUBSCRIBE_SECRET` 変更（既存の配信停止リンクは無効化される旨を許容）、全セッション削除 |
