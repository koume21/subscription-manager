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

```powershell
mkdir packages/shared/schemas, packages/shared/domain
pnpm --filter @subs/shared add -D typescript@^5.9.3
```

（`pnpm --filter` は `package.json` を先に作ってから実行する）

**`packages/shared/package.json`**

```json
{
  "name": "@subs/shared",
  "private": true,
  "type": "module",
  "exports": {
    "./schemas": "./schemas/index.ts",
    "./domain": "./domain/index.ts"
  },
  "scripts": {
    "typecheck": "tsc --noEmit"
  }
}
```

- `exports` に書いた入口だけが外から import できる（`@subs/shared/schemas`・`@subs/shared/domain`）
- ビルドせず `.ts` のまま公開する（server は tsx、web は Next.js がそのまま変換する）

**`packages/shared/schemas/index.ts`**

```ts
// web と server で共有するコード（動作確認用の定数）
export const APP_NAME = 'サブスク管理';
```

**`packages/shared/domain/index.ts`**

```ts
// 純粋関数（更新日計算・金額換算・リマインダー計画）を置く。DB に依存しないこと
export {};
```

**`packages/shared/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "preserve",
    "moduleResolution": "bundler",
    "types": [],
    "strict": true,
    "noEmit": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "skipLibCheck": true
  },
  "include": ["**/*.ts"],
  "exclude": ["node_modules"]
}
```

`types: []` で Node やブラウザの型を読み込まず、どちらでも動くコードだけを書けるようにしている。

---

## 4. サーバー（apps/server）

```powershell
mkdir apps/server/src
cd apps/server
pnpm init
pnpm add express "@subs/shared@workspace:*"
pnpm add -D typescript@^5.9.3 tsx @types/express @types/node@^24
cd ../..
```

**`apps/server/package.json`**：`pnpm init` が作った `version`・`description`・`main` などの欄は消し、次の形にする（依存関係の欄はそのまま）

```json
{
  "name": "@subs/server",
  "private": true,
  "type": "module",
  "scripts": {
    "dev": "tsx watch src/api.ts",
    "typecheck": "tsc --noEmit"
  }
}
```

**`apps/server/tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2023",
    "lib": ["ES2023"],
    "module": "preserve",
    "moduleResolution": "bundler",
    "types": ["node"],
    "strict": true,
    "noEmit": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true,
    "esModuleInterop": true,
    "resolveJsonModule": true,
    "skipLibCheck": true
  },
  "include": ["src/**/*.ts", "test/**/*.ts"]
}
```

実行は tsx が行うので、tsconfig は型チェック（`pnpm --filter @subs/server typecheck`）専用。

**`apps/server/src/api.ts`**（API サーバーの起動。ワーカーは別エントリーポイントの `src/worker.ts` に M6 で作る）

```ts
import express from 'express';
import { APP_NAME } from '@subs/shared/schemas';

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
pnpm --filter web add "@subs/shared@workspace:*"
pnpm --filter web add -D typescript@^5.9.3 @types/node@^24
```

- `--yes` で既定の設定のまま作成する
- `apps/web` の中に `pnpm-workspace.yaml`・`pnpm-lock.yaml`・`.git` が作られていたら削除する（ルートで一元管理するため）
- `apps/web/package.json` の `name` を `@subs/web` に変更し、`packageManager` の行を削除する（ルートで指定済み）
- `src/app/layout.tsx` の `metadata` と `lang` をアプリに合わせて書き換える（`lang="ja"`）
- `transpilePackages` の設定は不要（Next.js 16 はワークスペースのパッケージを自動で変換する）

TypeScript は 5.9 系にそろえる。7 系は `eslint-config-next`（typescript-eslint）が未対応で、`pnpm --filter @subs/web lint` が失敗する。

---

## 6. 起動と確認

```powershell
pnpm install
pnpm dev
```

| 確認先 | 期待結果 |
|---|---|
| http://localhost:3000 | 「サブスク管理」の見出し（`@subs/shared` の `APP_NAME`） |
| http://localhost:4000/api/v1/ping | `{"message":"サブスク管理 API is running"}` |

型チェック（server と shared）：

```powershell
pnpm -r typecheck
```

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
| Prettier・CI の拡充（テスト実行など） | M8 仕上げ（必要に応じて前倒し） |

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
