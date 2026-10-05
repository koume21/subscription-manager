# 05. API 設計（REST）

## 1. 共通仕様

| 項目 | 仕様 |
|---|---|
| ベース URL | `/api/v1`（ブラウザからは Next.js 経由の同一オリジン） |
| 形式 | `Content-Type: application/json; charset=utf-8` |
| 命名 | JSON のキーは camelCase |
| 日付 | `YYYY-MM-DD`（ユーザーのローカル日付） |
| 日時 | ISO 8601 UTC（例：`2026-10-13T00:00:00Z`） |
| 金額 | 整数（円） |
| 認証 | セッション Cookie（`__Host-sid`）。[06](06_auth_security.md) 参照 |
| CSRF | 状態変更系（POST/PUT/PATCH/DELETE）は `Origin` ヘッダーが自オリジンであることを検証 |
| リクエストサイズ | JSON ボディ最大 16KB |
| リクエスト ID | レスポンスヘッダー `X-Request-Id` を返す（ログ相関用） |
| 同時更新 | 単一ユーザー利用のため **後勝ち**（楽観ロックなし） |
| ページング | 1 ユーザー最大 200 件のため **ページングなし**（全件返却） |

### 1.1 エラーレスポンス（RFC 9457 Problem Details）

```json
{
  "type": "https://example.com/problems/validation-error",
  "title": "入力内容に誤りがあります",
  "status": 422,
  "code": "VALIDATION_ERROR",
  "errors": [
    { "field": "amount", "message": "0以上の整数で入力してください" }
  ],
  "requestId": "01J..."
}
```

`Content-Type: application/problem+json`。500 系では内部情報（スタックトレース等）を返さない。

### 1.2 ステータスコード方針

| コード | 用途 |
|---|---|
| 200 OK | 取得・更新成功（本文あり） |
| 201 Created | 作成成功（`Location` ヘッダー付き） |
| 202 Accepted | 受け付けたが非同期で処理（メール送信を伴うもの） |
| 204 No Content | 成功・本文なし |
| 400 Bad Request | JSON が壊れている等、構文エラー |
| 401 Unauthorized | 未ログイン・セッション切れ・認証失敗 |
| 403 Forbidden | Origin 検証失敗（CSRF） |
| 404 Not Found | リソースがない **または他人のリソース**（区別しない） |
| 409 Conflict | 状態の競合（例：解約済みを再度解約） |
| 413 Payload Too Large | ボディサイズ超過 |
| 422 Unprocessable Content | バリデーションエラー、件数上限超過 |
| 429 Too Many Requests | レート制限（`Retry-After` ヘッダー付き） |
| 500 Internal Server Error | 想定外エラー |
| 503 Service Unavailable | DB/Redis 接続不可（readyz） |

### 1.3 エラーコード一覧

| code | status | 意味 |
|---|---|---|
| `VALIDATION_ERROR` | 422 | 入力不正 |
| `UNAUTHENTICATED` | 401 | 未ログイン |
| `INVALID_CREDENTIALS` | 401 | メールまたはパスワードが違う |
| `INVALID_TOKEN` | 400 | 認証・リセットトークンが無効または期限切れ |
| `CSRF_REJECTED` | 403 | Origin 不一致 |
| `NOT_FOUND` | 404 | |
| `ALREADY_CANCELED` / `ALREADY_ACTIVE` | 409 | 状態競合 |
| `SUBSCRIPTION_LIMIT_EXCEEDED` | 422 | 200 件超過 |
| `RATE_LIMITED` | 429 | |
| `INTERNAL_ERROR` | 500 | |

## 2. エンドポイント一覧

| メソッド | パス | 認証 | 概要 |
|---|---|---|---|
| POST | `/auth/signup` | − | サインアップ |
| POST | `/auth/verify-email` | − | メール認証 |
| POST | `/auth/verify-email/resend` | ○ | 認証メール再送 |
| POST | `/auth/login` | − | ログイン |
| POST | `/auth/logout` | ○ | ログアウト |
| POST | `/auth/password-reset/request` | − | リセットメール送信 |
| POST | `/auth/password-reset/confirm` | − | 新パスワード設定 |
| GET | `/me` | ○ | 自分の情報・設定 |
| PATCH | `/me/settings` | ○ | 通知設定・タイムゾーン変更 |
| PUT | `/me/password` | ○ | パスワード変更 |
| DELETE | `/me` | ○ | 退会 |
| GET | `/subscriptions` | ○ | 一覧 |
| POST | `/subscriptions` | ○ | 登録 |
| GET | `/subscriptions/{id}` | ○ | 詳細 |
| PATCH | `/subscriptions/{id}` | ○ | 編集 |
| DELETE | `/subscriptions/{id}` | ○ | 削除 |
| POST | `/subscriptions/{id}/cancel` | ○ | 解約済みにする |
| POST | `/subscriptions/{id}/reactivate` | ○ | 契約中に戻す |
| GET | `/subscriptions/{id}/reminders` | ○ | 通知履歴 |
| GET | `/dashboard/summary` | ○ | 可視化用集計 |
| POST | `/email/unsubscribe` | トークン | 通知の配信停止 |
| GET | `/healthz` | − | 死活監視（プロセス生存のみ） |
| GET | `/readyz` | − | DB・Redis 疎通確認 |

> `/healthz`, `/readyz` は `/api/v1` 配下ではなくルート直下に置く（プラットフォームのヘルスチェック用）

## 3. 認証 API

### POST /auth/signup

```json
// リクエスト
{ "email": "user@example.com", "password": "correct horse battery staple", "timezone": "Asia/Tokyo" }
```

- `timezone` はブラウザの `Intl.DateTimeFormat().resolvedOptions().timeZone` を自動送信（不正なら既定値）
- レスポンス：**202 Accepted**（本文 `{ "message": "確認メールを送信しました" }`）
- **アカウント列挙対策**：既に登録済みのメールでも同じ 202 を返し、そのアドレスには「既に登録済みです。ログインまたはパスワードリセットを行ってください」というメールを送る
- 新規の場合：ユーザー作成 → 認証トークン発行 → 認証メールをキュー投入 → セッションは **発行しない**（認証リンクからログインへ誘導）

### POST /auth/verify-email

```json
{ "token": "base64url文字列" }
```
- 成功：204。`email_verified_at` を設定し、トークンを使用済みにする
- 失敗：400 `INVALID_TOKEN`
- 認証完了時、そのユーザーの全 ACTIVE サブスクのリマインダーを生成（未認証中はリマインダーを生成しない）

### POST /auth/verify-email/resend
- 未認証ユーザーのみ。202。レート制限：1 ユーザー 5 回/時

### POST /auth/login

```json
{ "email": "user@example.com", "password": "..." }
```
- 成功：200 ＋ `Set-Cookie: __Host-sid=...`、本文は `GET /me` と同じ
- 失敗：401 `INVALID_CREDENTIALS`（メール不存在とパスワード違いを区別しない。不存在時もダミーハッシュ検証を行い応答時間を揃える）
- 未認証ユーザーもログイン可能（`emailVerified: false` を返し、画面で認証を促す）

### POST /auth/logout
- 204。DB のセッション削除＋Cookie 削除

### POST /auth/password-reset/request
```json
{ "email": "user@example.com" }
```
- 常に 202（存在有無を明かさない）。存在する場合のみリセットメールを送る

### POST /auth/password-reset/confirm
```json
{ "token": "...", "newPassword": "..." }
```
- 成功：204。パスワード更新、トークン使用済み化、**そのユーザーの全セッション削除**
- リセットリンクからのアクセス＝メール所有の証明になるため、未認証なら `email_verified_at` も設定する

## 4. ユーザー API

### GET /me → 200

```json
{
  "id": "6f1c...",
  "email": "user@example.com",
  "emailVerified": true,
  "settings": {
    "timezone": "Asia/Tokyo",
    "notifyHour": 9,
    "reminderEnabled": true,
    "defaultReminderOffsets": [7, 1]
  },
  "createdAt": "2026-10-05T03:00:00Z"
}
```

### PATCH /me/settings → 200（`GET /me` と同じ形）

```json
{ "timezone": "Asia/Tokyo", "notifyHour": 8, "reminderEnabled": true, "defaultReminderOffsets": [14, 3, 0] }
```
- 全項目任意（部分更新）
- `timezone` / `notifyHour` / `defaultReminderOffsets` / `reminderEnabled` が変わった場合、そのユーザーの未送信リマインダーを **同一トランザクションで再生成**（[07](07_reminder_jobs.md) §4）

### PUT /me/password → 204
```json
{ "currentPassword": "...", "newPassword": "..." }
```
- 現在のパスワード不一致：401 `INVALID_CREDENTIALS`
- 成功時、**現在のセッション以外を全削除**し、現在のセッション ID も再発行

### DELETE /me → 204
```json
{ "password": "..." }
```
- パスワード確認後、ユーザーを物理削除（CASCADE）。Cookie 削除
- キュー上に残るそのユーザーのジョブは、ワーカー側で「レコードが存在しない」ため何もせず完了する

## 5. サブスク API

### 5.1 リソース表現

```json
{
  "id": "b2a1...",
  "name": "Netflix",
  "amount": 1590,
  "intervalUnit": "MONTH",
  "intervalCount": 1,
  "billingAnchorDate": "2025-04-12",
  "nextRenewalDate": "2026-10-12",
  "status": "ACTIVE",
  "isTrial": false,
  "reminderEnabled": true,
  "reminderOffsets": null,
  "effectiveReminderOffsets": [7, 1],
  "cancelUrl": "https://www.netflix.com/cancelplan",
  "memo": "家族プラン",
  "monthlyEquivalent": 1590,
  "yearlyEquivalent": 19080,
  "canceledAt": null,
  "createdAt": "2026-10-05T03:00:00Z",
  "updatedAt": "2026-10-05T03:00:00Z"
}
```

- `reminderOffsets: null` は「ユーザー既定を使う」。`effectiveReminderOffsets` は実際に使われる値（表示用・読み取り専用）
- `nextRenewalDate`、`monthlyEquivalent`、`yearlyEquivalent` は **サーバー計算値（読み取り専用）**。リクエストで送られても無視する

### 5.2 GET /subscriptions → 200

クエリ：

| パラメータ | 値 | 既定 |
|---|---|---|
| status | `active` \| `canceled` \| `all` | `active` |
| sort | `nextRenewalDate` \| `amount` \| `monthlyEquivalent` \| `name` \| `createdAt` | `nextRenewalDate` |
| order | `asc` \| `desc` | `asc` |

```json
{ "items": [ { ...サブスク } ], "total": 12 }
```

### 5.3 POST /subscriptions → 201

```json
{
  "name": "Netflix",
  "amount": 1590,
  "intervalUnit": "MONTH",
  "intervalCount": 1,
  "billingAnchorDate": "2025-04-12",
  "isTrial": false,
  "reminderEnabled": true,
  "reminderOffsets": null,
  "cancelUrl": "https://www.netflix.com/cancelplan",
  "memo": "家族プラン"
}
```

処理（1 トランザクション）：
1. 件数上限チェック（200 件。超過は 422 `SUBSCRIPTION_LIMIT_EXCEEDED`）
2. `next_renewal_date` を計算（ユーザー TZ の今日基準）
3. INSERT
4. リマインダー生成（ユーザーがメール認証済みかつ通知 ON の場合）

レスポンス：201、`Location: /api/v1/subscriptions/{id}`、本文はサブスクリソース

### 5.4 GET /subscriptions/{id} → 200 / 404

### 5.5 PATCH /subscriptions/{id} → 200

- 部分更新。`status` はここでは変更不可（cancel / reactivate を使う）
- `billingAnchorDate`、`intervalUnit`、`intervalCount` が変わったら `next_renewal_date` を再計算
- 通知に影響する項目（上記＋`reminderEnabled`、`reminderOffsets`、`isTrial`、`name`※）が変わったら未送信リマインダーを再生成
  - ※`name` は送信時にサブスクから読むので再生成不要。再生成対象は日付・オフセット・ON/OFF のみ
- `intervalUnit` を変える場合は `intervalCount` も同時に検証（YEAR で 6 等はエラー）

### 5.6 DELETE /subscriptions/{id} → 204
- 物理削除（リマインダーも CASCADE 削除）

### 5.7 POST /subscriptions/{id}/cancel → 200
- `status=CANCELED`、`canceled_at=now()`、未送信リマインダーを `SKIPPED(SUBSCRIPTION_CANCELED)`
- 既に CANCELED：409 `ALREADY_CANCELED`

### 5.8 POST /subscriptions/{id}/reactivate → 200
- `status=ACTIVE`、`canceled_at=NULL`、`next_renewal_date` を再計算、リマインダー生成
- 既に ACTIVE：409 `ALREADY_ACTIVE`
- 件数上限は解約済みも含めてカウントしているため再チェック不要

### 5.9 GET /subscriptions/{id}/reminders → 200

```json
{
  "items": [
    {
      "id": "c9...",
      "renewalDate": "2026-10-12",
      "offsetDays": 7,
      "scheduledAt": "2026-10-05T00:00:00Z",
      "status": "SENT",
      "skipReason": null,
      "sentAt": "2026-10-05T00:01:12Z"
    }
  ]
}
```
- 新しい順、最大 50 件。`lastError` などの内部情報は返さない

## 6. ダッシュボード API

### GET /dashboard/summary → 200

```json
{
  "activeCount": 8,
  "trialCount": 1,
  "monthlyTotal": 9820,
  "yearlyTotal": 117840,
  "byCycle": [
    { "label": "MONTHLY", "count": 6, "monthlyTotal": 7320 },
    { "label": "YEARLY",  "count": 2, "monthlyTotal": 2500 }
  ],
  "byService": [
    { "id": "b2a1...", "name": "Netflix", "monthlyEquivalent": 1590 }
  ],
  "upcoming": [
    { "id": "b2a1...", "name": "Netflix", "nextRenewalDate": "2026-10-12", "amount": 1590, "isTrial": false, "daysUntil": 7 }
  ],
  "asOf": "2026-10-05"
}
```

- 対象は ACTIVE のみ
- `byCycle` の `label`：`intervalUnit=MONTH` を `MONTHLY`、`YEAR` を `YEARLY` としてまとめる（3 か月ごと等は MONTHLY 側）
- `byService` は `monthlyEquivalent` 降順
- `upcoming` は今日〜30 日後に `nextRenewalDate` があるもの、日付昇順
- `asOf` はユーザー TZ の今日（計算の基準日）
- 合計の丸めは [03](03_domain_logic.md) §4 に従う

## 7. 配信停止 API

### POST /email/unsubscribe → 204

```json
{ "token": "署名付きトークン" }
```

- トークン：`base64url(userId) + "." + HMAC-SHA256(UNSUBSCRIBE_SECRET, "unsubscribe:" + userId)`。期限なし（メールは後から開かれるため）
- 成功で `users.reminder_enabled=false` ＋ 未送信リマインダーを SKIPPED。ログイン不要
- 同じトークンで何度呼んでも 204（冪等）
- 不正トークン：400 `INVALID_TOKEN`
- メールの `List-Unsubscribe` / `List-Unsubscribe-Post: List-Unsubscribe=One-Click` ヘッダー（RFC 8058）からも呼ばれるため、**`application/x-www-form-urlencoded` のボディも受け付け、この API だけは Origin 検証の対象外**とする（トークン自体が認可の役割を持つため）
  - ワンクリック用 URL：`POST /api/v1/email/unsubscribe?token=...`

## 8. レート制限

| 対象 | 上限 | キー |
|---|---|---|
| `/auth/login` | 10 回 / 15 分 | IP |
| `/auth/login` | 5 回連続失敗で 15 分ブロック | メールアドレス＋IP の組（第三者による本人ロックアウトを防ぐため、メール単独ではロックしない） |
| `/auth/login` | 50 回失敗 / 日 | メールアドレス（分散 IP からの総当たり対策） |
| `/auth/signup` | 5 回 / 時 | IP |
| `/auth/password-reset/request` | 3 回 / 時 | メールアドレス、および 10 回 / 時 IP |
| `/auth/verify-email/resend` | 5 回 / 時 | ユーザー |
| その他認証済み API | 300 回 / 分 | ユーザー |

実装：`rate-limiter-flexible` ＋ Redis。プロキシ配下のため Express の `trust proxy` を正しく設定して実 IP を取得する。
