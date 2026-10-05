# 11. 開発環境構築手順（最低限・Windows 11）

**フロント（Next.js）とバック（Express）の実装を始められる状態** までだけを作る。
DB（Prisma・Docker）、Lint、CI などは、必要になったマイルストーン（[10_roadmap.md](10_roadmap.md)）で導入する。

ゴール：`pnpm dev` で web（http://localhost:3000）と server（http://localhost:4000）が起動する。

---

## 1. ツール

| ツール | バージョン | 入れ方 |
|---|---|---|
| fnm | 1.39 | `winget install Schniz.fnm` |
| Node.js | 24 LTS | `fnm install 24` → `fnm default 24` |
| pnpm | 12.9 | `corepack enable pnpm` |

PowerShell 起動時に fnm を有効にする設定（設定後は PowerShell を開き直す）：

```powershell
Set-ExecutionPolicy -Scope CurrentUser RemoteSigned
if (-not (Test-Path $PROFILE)) { New-Item -ItemType File -Path $PROFILE -Force }
Add-Content $PROFILE 'fnm env --use-on-cd --shell powershell | Out-String | Invoke-Expression'
```

---

## 2. ルート

```powershell
cd C:\Users\tkoum\projects\subscription-manager
git init
"24" | Out-File -Encoding ascii .node-version
mkdir apps, packages
```

**`package.json`**

```json
{
  "name": "subscription-manager",
  "private": true,
  "type": "module",
  "packageManager": "pnpm@12.9.1",
  "scripts": {
    "dev": "pnpm --parallel --filter \"./apps/**\" dev"
  }
}
```

**`pnpm-workspace.yaml`**（ファイル末尾に改行を入れること。ないと pnpm の自動追記で書式が壊れる）

```yaml
packages:
  - "apps/*"
  - "packages/*"

# インストール時のスクリプト実行を許可するパッケージ（pnpm 11 以降は許可制）
allowBuilds:
  "@prisma/engines": true
  prisma: true
  esbuild: true
  sharp: true
  unrs-resolver: true
```

**`.gitignore`**

```
node_modules/
dist/
.next/
.env
.env.*
apps/server/src/generated/
```

---

## 3. 共有パッケージ（packages/shared）

**`packages/shared/package.json`**

```json
{
  "name": "@subs/shared",
  "private": true,
  "type": "module",
  "exports": {
    ".": "./src/index.ts"
  }
}
```

**`packages/shared/src/index.ts`**

```ts
// web と server で共有するコード（動作確認用の定数）
export const APP_NAME = 'サブスク管理';
```

---

## 4. サーバー（apps/server）

```powershell
mkdir apps/server/src
cd apps/server
pnpm init
pnpm add express "@subs/shared@workspace:*"
pnpm add -D typescript tsx @types/express @types/node
cd ../..
```

**`apps/server/package.json`**：`name` と `scripts` を変更（他の欄はそのまま）

```json
{
  "name": "@subs/server",
  "scripts": {
    "dev": "tsx watch src/index.ts"
  }
}
```

**`apps/server/src/index.ts`**

```ts
import express from 'express';
import { APP_NAME } from '@subs/shared';

const app = express();

// 動作確認用
app.get('/api/v1/ping', (_req, res) => {
  res.json({ message: `${APP_NAME} API is running` });
});

app.listen(4000, () => {
  console.log('API サーバー起動: http://localhost:4000');
});
```

---

## 5. フロント（apps/web）

```powershell
cd apps
pnpm create next-app@latest web --yes
cd ..
```

- `--yes` で既定の設定のまま作成する
- `apps/web` の中に `pnpm-workspace.yaml`・`pnpm-lock.yaml`・`.git` が作られていたら削除する（ルートで一元管理するため）

---

## 6. 起動と確認

```powershell
pnpm install
pnpm dev
```

| 確認先 | 期待結果 |
|---|---|
| http://localhost:3000 | Next.js の初期画面 |
| http://localhost:4000/api/v1/ping | `{"message":"サブスク管理 API is running"}` |

確認できたら最初のコミットをする。

```powershell
git add .
git commit -m "chore: 開発環境の初期構築"
```

---

## 7. 後から追加するもの（この手順では入れない）

| もの | 追加するタイミング |
|---|---|
| zod・date-fns・Vitest | M1 ドメインロジック |
| Docker（Postgres・Redis・Mailpit）・Prisma・`.env` | M2 DB |
| Next.js → Express のプロキシ（rewrites） | M3 認証（フロントから API を呼び始めるとき） |
| helmet・argon2・レート制限・ログ | M3 認証 |
| TanStack Query・React Hook Form | M4 CRUD 画面 |
| Recharts | M5 可視化 |
| BullMQ・Worker・メール送信 | M6 非同期基盤 |
| tsconfig の調整・ESLint・Prettier・CI | M8 仕上げ（必要に応じて前倒し） |

Prisma を入れるときは、`prisma` と `@prisma/client` のバージョンをそろえる（npm の `prisma` の `latest` タグが RC 版を指していることがあるため、`prisma@<clientと同じ版>` と明示する）。

---

## 8. トラブルシューティング

| 症状 | 対処 |
|---|---|
| `fnm` などが認識されない | PowerShell を開き直す |
| プロファイル読込で「スクリプトの実行が無効」 | `Set-ExecutionPolicy -Scope CurrentUser RemoteSigned` |
| `pnpm-workspace.yaml` のパースエラー | 末尾の改行漏れで pnpm の追記が前の行にくっついていないか確認 |
| `pnpm install` がビルドスクリプトの件でエラー終了 | `pnpm approve-builds` で許可してから再実行 |
| `port is already allocated` / `EADDRINUSE` | 3000・4000 番を使っている別プロセスを停止する |
