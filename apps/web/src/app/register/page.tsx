"use client";
import { useState } from "react";
import Link from "next/link";

type FieldError = {
    field: string;
    message: string;
}


export default function Register() {
    const [checkEmail, setCheckEmail] = useState(""); // メールアドレスの入力データ
    const [checkPassword, setCheckPassword] = useState(""); // パスワードの入力データ


    const [message, setMessage] = useState(""); // 202レスポンスメッセージ
    const [errorEmail,setErrorEmail] = useState(""); // メールアドレス入力エラー
    const [errorPassword,setErrorPassword] = useState(""); // パスワード入力エラー
    const [errorServer,setErrorServer] = useState(""); // 500 や通信エラーのときのメッセージ
    async function register(formData: FormData) {
        // 変数の初期化
        setMessage("");
        setErrorEmail("");
        setErrorPassword("");
        setErrorServer("");
        
        try {
            // 入力データの送信
            const res = await fetch("/api/v1/auth/signup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ 
                    email    : formData.get("email"),
                    password : formData.get("password"),
                }),
            });
            const data = await res.json();
            if(res.status === 202) {
                setMessage(data.message);
            } else if(res.status === 422) {
                const errors: FieldError[] = data.errors;
                setErrorEmail(errors.find((error) => error.field === "email")?.message ?? "");
                setErrorPassword(errors.find((error) => error.field === "password")?.message ?? "");
            } else {
                setErrorServer(data.title ?? "サーバーでエラーが発生しました。");
            }
        } catch(error) {
            console.error(error);
            setErrorServer("通信に失敗しました。時間をおいて再度お試しください");
        }
        
    }

    return (
        <main className="flex min-h-screen items-center justify-center px-4">
            <form
                action={register}
                className="w-full max-w-sm space-y-5 rounded-xl border border-gray-200 p-8 shadow-sm dark:border-gray-800"
            >
                <h1 className="text-center text-2xl font-bold">新規登録</h1>

                {errorServer && (
                    <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                        {errorServer}
                    </p>
                )}
                {message && (
                    <p className="rounded-md bg-green-50 px-3 py-2 text-sm text-green-700 dark:bg-green-950 dark:text-green-300">
                        {message}
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
                        autoComplete="new-password"
                        placeholder="8文字以上"
                        value={checkPassword}
                        onChange={(e) => setCheckPassword(e.target.value)}
                        className="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-gray-700"
                    />
                    {errorPassword && <p className="text-sm text-red-600 dark:text-red-400">{errorPassword}</p>}
                </div>

                <button className="w-full rounded-md bg-blue-600 py-2 font-medium text-white hover:bg-blue-700">
                    登録
                </button>

                <p className="text-center text-sm">
                    アカウントをお持ちの方は
                    <Link href="/login" className="ml-1 text-blue-600 hover:underline dark:text-blue-400">
                        ログイン
                    </Link>
                </p>
            </form>
        </main>
    )
}
