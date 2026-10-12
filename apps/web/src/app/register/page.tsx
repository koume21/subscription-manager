"use client";
import { useState } from "react";

export default function Register() {
    const [message, setMessage] = useState("");

    async function register(formData: FormData) {
        const res = await fetch("/api/v1/auth/signup", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ 
                email    : formData.get("email"),
                password : formData.get("password"),
            }),
        });
        const data = await res.json();
        setMessage(data.message);
    }

    return (
        <main>
            <form action={register}>
                <h1 className="text-3xl font-bold">Register</h1>
                <p>メールアドレス</p>
                <input className="border p-2 rounded" type="email" name="email"/>
                <p>パスワード</p>
                <input className="border p-2 rounded" type="password" name="password"/>
                <button className="bg-blue-500 text-white p-2 rounded">登録</button>
            </form>
            {message && <p>{message}</p>}
        </main>
    )
}
