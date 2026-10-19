"use client";
import { useRouter } from "next/navigation";
import { useEffect,useState } from "react";

export default function Home () {
    const router = useRouter();
    const [loading, setLoading] = useState(true);
    // homeに遷移後/meを確認し、ログイン状況取得
    useEffect(() => {
        async function load() {
            const res = await fetch('/api/v1/me');
            if (res.status === 401) {
                router.replace('/login');
            } else {
                setLoading(false);
            }
        }
        load();
    }, [router]);

    async function logout() {
        const res = await fetch('/api/v1/auth/logout', {
            method: 'POST',
        });

        if(res.status === 204) {
            router.push("/");
        }
    }

    if(loading) {
        return <p>読み込み中...</p>
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