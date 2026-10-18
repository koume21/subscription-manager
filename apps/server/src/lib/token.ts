// セッション用トークンの生成とハッシュ化（docs/06_auth_security.md §3.1）
// トークン（Cookie に入れる値）と、そのハッシュ（DB の sessions.id に保存する値）を扱う
// DB にはハッシュだけを保存するので、DB が漏れても Cookie の値は分からない
import { randomBytes,createHash } from 'node:crypto';

// トークンの長さ（バイト数）。32 バイト = 256 ビットあれば総当たりで当てるのは事実上不可能
const TOKEN_BYTES = 32;

// 推測できないランダムなトークンを作る（Cookie に入れる値）
// randomBytes は OS の安全な乱数を使う（Math.random は予測される可能性があるので使わない）
// base64url は Cookie や URL で特別な意味を持つ + / = を含まない形式（32 バイト → 43 文字）
export function generateToken() {
    return randomBytes(TOKEN_BYTES).toString('base64url');
}

// トークンを SHA-256 でハッシュにする（DB に保存・検索するときの値。hex で 64 文字）
// 同じトークンからは必ず同じ値が出るので、Cookie のトークンから DB のセッションを探せる
// トークン自体が十分ランダムなので、パスワードのような遅い bcrypt ではなく速い SHA-256 で足りる
export function hashToken(token: string) {
    return createHash('sha256').update(token).digest('hex');
}
