"use client";
import { useState } from "react";

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
        <main>
            <form action={register}>
                <h1 className="text-3xl font-bold">新規登録</h1>
                {errorServer && <p>{errorServer}</p>}
                <p>メールアドレス</p>
                <input className="border p-2 rounded"
                    value={checkEmail}
                    onChange={(e) => setCheckEmail(e.target.value)}
                    type="email"
                    name="email"
                />
                {errorEmail && <p>{errorEmail}</p>}
                <p>パスワード</p>
                <input className="border p-2 rounded"
                    onChange={(e) => setCheckPassword(e.target.value)}
                    value={checkPassword}
                    type="password"
                    name="password"/>
                {errorPassword && <p>{errorPassword}</p>}
                <button className="bg-blue-500 text-white p-2 rounded">登録</button>
            </form>
            {message && <p>{message}</p>}
        </main>
    )
}
