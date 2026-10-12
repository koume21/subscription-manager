import Link from "next/link";
export default function Login() {
  return (
    <main>
        <h1 className="text-3xl font-bold">Login</h1>
        <p>メールアドレス</p>
        <input className="border p-2 rounded" type="email" name="email"/>
        <p>パスワード</p>
        <input className="border p-2 rounded" type="password" name="password"/>
        <button className="bg-blue-500 text-white p-2 rounded">ログイン</button>

        <Link href="/register" className="text-blue-500 underline">新規登録</Link>

    </main>
  );
}