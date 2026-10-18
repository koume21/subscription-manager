"use client";
import { useRouter } from "next/navigation";

export default function Home () {
    const router = useRouter()
    async function logout() {
        const res = await fetch('/api/v1/auth/logout', {
            method: 'POST',
        });

        if(res.status === 204) {
            router.push("/");
        }
    }
    return(
        <main>
            <h1>成功</h1>
            <form action={logout}>
                <button>ログアウト</button>
            </form>
        </main>
        
    )
}