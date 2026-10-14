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
    <main>
        
        <form action={login}>
          <h1 className="text-3xl font-bold">Login</h1>
          { approvalError && <p>{approvalError}</p> }
          { errorServer && <p>{errorServer}</p> }
          <p>メールアドレス</p>
          <input className="border p-2 rounded"
            type="email"
            name="email"
            value={checkEmail}
            onChange={(e) => setCheckEmail(e.target.value)}
          />
          { errorEmail && <p>{errorEmail}</p> }
          <p>パスワード</p>
          <input className="border p-2 rounded" 
            type="password"
            name="password"
            value={checkPassword}
            onChange={(e) => setCheckPassword(e.target.value)}
          />
          { errorPassword && <p>{errorPassword}</p> }
          {loading ? <p>ログイン中...</p> :
          <button className="bg-blue-500 text-white p-2 rounded">ログイン</button>
          }

          <Link href="/register" className="text-blue-500 underline">新規登録</Link>
        </form>
    </main>
  );
}