"use client";
import Link from "next/link";
import { useState } from "react";
import { useRouter } from "next/navigation";

type FieldError = {
    field: string;
    message: string;
}

export default function Login() {
  const router = useRouter();
  const [checkEmail, setCheckEmail] = useState(""); // メールアドレスの入力データ
  const [checkPassword, setCheckPassword] = useState(""); // パスワードの入力データ

  //const [message, setMessage] = useState(""); // 202レスポンスメッセージ
  const [approvalError,setApprovalError] = useState(""); // 401の認証エラー
  const [errorEmail,setErrorEmail] = useState(""); // メールアドレス入力エラー
  const [errorPassword,setErrorPassword] = useState(""); // パスワード入力エラー
  const [errorServer,setErrorServer] = useState(""); // 500 や通信エラーのときのメッセージ
  const [loading, setLoading] = useState(false);
  
  async function login(formData: FormData) {
    // 変数の初期化
    setApprovalError("");
    setErrorEmail("");
    setErrorPassword("");
    setErrorServer("");
    
    setLoading(true); // ログイン処理開始

    try {
      const res = await fetch('/api/v1/auth/login',{
        method: "POST",
        headers: { "Content-Type": "application/json"},
        body: JSON.stringify({
          email: formData.get("email"),
          password: formData.get("password"),
        })
      });

      const data = await res.json();

      if(res.status === 200) {
        router.push("/home");
      } else if(res.status === 401) {
        setApprovalError(data.title);
      } else if(res.status === 422) {
        const errors: FieldError[] = data.errors;
        setErrorEmail(errors.find((error) => error.field === "email")?.message ?? "");
        setErrorPassword(errors.find((error) => error.field === "password")?.message ?? "");
      } else {
        setErrorServer(data.title ?? "サーバーでエラーが発生しました");
      }

    } catch(error) {
      console.error(error);
      setErrorServer("通信に失敗しました。時間をおいて再度お試しください");
    } finally {
      setLoading(false);
    }
  }
  return (
    <main className="flex min-h-screen items-center justify-center px-4">
      <form
        action={login}
        className="w-full max-w-sm space-y-5 rounded-xl border border-gray-200 p-8 shadow-sm dark:border-gray-800"
      >
        <h1 className="text-center text-2xl font-bold">ログイン</h1>

        {approvalError && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {approvalError}
          </p>
        )}
        {errorServer && (
          <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
            {errorServer}
          </p>
        )}

        <div className="space-y-1">
          <label htmlFor="email" className="block text-sm font-medium">
            メールアドレス
          </label>
          <input
            id="email"
            name="email"
            type="email"
            autoComplete="email"
            placeholder="user@example.com"
            value={checkEmail}
            onChange={(e) => setCheckEmail(e.target.value)}
            className="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-gray-700"
          />
          {errorEmail && <p className="text-sm text-red-600 dark:text-red-400">{errorEmail}</p>}
        </div>

        <div className="space-y-1">
          <label htmlFor="password" className="block text-sm font-medium">
            パスワード
          </label>
          <input
            id="password"
            name="password"
            type="password"
            autoComplete="current-password"
            value={checkPassword}
            onChange={(e) => setCheckPassword(e.target.value)}
            className="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-gray-700"
          />
          {errorPassword && <p className="text-sm text-red-600 dark:text-red-400">{errorPassword}</p>}
        </div>

        <button
          disabled={loading}
          className="w-full rounded-md bg-blue-600 py-2 font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
        >
          {loading ? "ログイン中..." : "ログイン"}
        </button>

        <p className="text-center text-sm">
          アカウントをお持ちでない方は
          <Link href="/register" className="ml-1 text-blue-600 hover:underline dark:text-blue-400">
            新規登録
          </Link>
        </p>
      </form>
    </main>
  );
}