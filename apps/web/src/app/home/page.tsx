"use client";
import { useRouter } from "next/navigation";
import { useEffect,useState } from "react";

// GET /api/v1/subscriptions が返す 1 件分の形
type Subscription = {
    id: string;
    name: string;
    amount: number;
    registeredOn: string | null;
    user: { email: string };
};

type FieldError = {
    field: string;
    message: string;
};

// フォームの入力値（input の value は文字列なので、送信するときに変換する）
type FormValues = {
    name: string;
    amount: string;
    registeredOn: string;
};

const EMPTY_FORM: FormValues = { name: '', amount: '', registeredOn: '' };

// 一覧を取得する。未ログイン（401）なら null を返す
async function fetchSubscriptions(): Promise<Subscription[] | null> {
    const res = await fetch('/api/v1/subscriptions');
    if (res.status === 401) return null;
    if (!res.ok) throw new Error(`一覧の取得に失敗しました（${res.status}）`);
    return res.json();
}

// "2026-10-01T00:00:00.000Z" → "2026年10月1日"
function formatDate(value: string | null) {
    if (!value) return '未登録';
    return new Date(value).toLocaleDateString('ja-JP', {
        year: 'numeric',
        month: 'long',
        day: 'numeric',
        timeZone: 'UTC',
    });
}

export default function Home () {
    const router = useRouter(); //router
    const [loading, setLoading] = useState(true); // 画面表示状態管理
    const [subList, setSubList] = useState<Subscription[]>([]); // サブスク一覧管理
    const [modalOpen, setModalOpen] = useState(false); // 登録・編集モーダルの表示状態
    const [editingId, setEditingId] = useState<string | null>(null); // 編集中のサブスクの id（null なら新規登録）
    const [form, setForm] = useState<FormValues>(EMPTY_FORM); // フォームの入力値
    const [fieldErrors, setFieldErrors] = useState<FieldError[]>([]); // 422 の項目ごとのエラー
    const [errorMessage, setErrorMessage] = useState(""); // 項目に紐づかないエラー（上限・500・通信エラー）
    const [saving, setSaving] = useState(false); // 送信中（二重送信防止）

    // homeに遷移後、一覧を取得。未ログインなら /login へ
    useEffect(() => {
        async function load() {
            const list = await fetchSubscriptions();
            if (list === null) {
                router.replace('/login');
                return;
            }
            setSubList(list);
            setLoading(false);
        }
        load();
    }, [router]);

    // 登録・編集・削除のあとに一覧を取り直す
    async function reload() {
        const list = await fetchSubscriptions();
        if (list === null) {
            router.replace('/login');
            return;
        }
        setSubList(list);
    }

    // 「+ 登録」：空のフォームでモーダルを開く
    function openCreate() {
        setEditingId(null);
        setForm(EMPTY_FORM);
        setFieldErrors([]);
        setErrorMessage("");
        setModalOpen(true);
    }

    // 「編集」：一覧で取得済みの値をフォームに入れてモーダルを開く
    function openEdit(s: Subscription) {
        setEditingId(s.id);
        setForm({
            name: s.name,
            amount: String(s.amount),
            // "2026-10-01T00:00:00.000Z" → "2026-10-01"（<input type="date"> の形）
            registeredOn: s.registeredOn ? s.registeredOn.slice(0, 10) : '',
        });
        setFieldErrors([]);
        setErrorMessage("");
        setModalOpen(true);
    }

    function closeModal() {
        setModalOpen(false);
    }

    // 項目名からエラーメッセージを取り出す
    function errorOf(field: keyof FormValues) {
        return fieldErrors.find((error) => error.field === field)?.message ?? "";
    }

    // サブスク登録（POST）・編集（PATCH）
    async function saveSubsc() {
        setFieldErrors([]);
        setErrorMessage("");
        setSaving(true);

        try {
            const res = await fetch(
                editingId ? `/api/v1/subscriptions/${editingId}` : '/api/v1/subscriptions',
                {
                    method: editingId ? 'PATCH' : 'POST',
                    headers: { "Content-Type": "application/json"},
                    body: JSON.stringify({
                        name: form.name,
                        // 空欄は null にして、サーバーで「金額を入力してください」にする（Number('') は 0 になるため）
                        amount: form.amount === '' ? null : Number(form.amount),
                        registeredOn: form.registeredOn === '' ? null : form.registeredOn,
                    })
                }
            );

            if (res.status === 201 || res.status === 200) {
                setModalOpen(false);
                await reload();
            } else if (res.status === 401) {
                router.replace('/login');
            } else if (res.status === 404) {
                // 別のタブで削除された場合など
                setModalOpen(false);
                await reload();
            } else {
                const data = await res.json();
                if (res.status === 422 && data.errors) {
                    setFieldErrors(data.errors);
                } else {
                    setErrorMessage(data.title ?? "サーバーでエラーが発生しました");
                }
            }
        } catch (error) {
            console.error(error);
            setErrorMessage("通信に失敗しました。時間をおいて再度お試しください");
        } finally {
            setSaving(false);
        }
    }

    // サブスク削除（DELETE）
    async function deleteSubsc(s: Subscription) {
        if (!window.confirm(`「${s.name}」を削除しますか？\nこの操作は取り消せません`)) {
            return;
        }

        const res = await fetch(`/api/v1/subscriptions/${s.id}`, {
            method: 'DELETE',
        });

        if (res.status === 401) {
            router.replace('/login');
            return;
        }
        if (res.status !== 204 && res.status !== 404) {
            window.alert("削除に失敗しました");
        }
        // 204（削除できた）・404（すでにない）のどちらでも、一覧を最新にする
        await reload();
    }

    // ログアウト処理（POST)
    async function logout() {
        const res = await fetch('/api/v1/auth/logout', {
            method: 'POST',
        });

        if(res.status === 204) {
            router.push("/");
        }
    }
    // ページ取得中
    if(loading) {
        return (
            <main className="flex min-h-screen items-center justify-center">
                <p className="text-gray-500">読み込み中...</p>
            </main>
        )
    }

    return(
        <div className="min-h-screen">
            {/* ヘッダー：左にタイトル、右にログアウト */}
            <header className="border-b border-gray-200 dark:border-gray-800">
                <div className="mx-auto flex max-w-2xl items-center justify-between px-4 py-4">
                    <h1 className="text-lg font-bold">サブスク管理</h1>
                    <form action={logout}>
                        <button className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-900">
                            ログアウト
                        </button>
                    </form>
                </div>
            </header>

            <main className="mx-auto max-w-2xl space-y-6 px-4 py-8">
                {/* 見出し行：左に見出し、右に登録ボタン */}
                <div className="flex items-center justify-between">
                    <h2 className="text-xl font-bold">サブスク一覧</h2>
                    <button
                        onClick={openCreate}
                        className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700"
                    >
                        + 登録
                    </button>
                </div>

                {/* 登録・編集モーダル：画面全体を覆う背景の上にフォームを重ねる */}
                {modalOpen &&
                    <div
                        onClick={closeModal}
                        className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 px-4"
                    >
                        <form
                            action={saveSubsc}
                            onClick={(e) => e.stopPropagation()}
                            role="dialog"
                            aria-modal="true"
                            className="w-full max-w-md space-y-4 rounded-xl bg-white p-6 shadow-lg dark:bg-gray-900"
                        >
                            <p className="font-bold">{editingId ? 'サブスク編集' : 'サブスク登録'}</p>

                            {errorMessage && (
                                <p className="rounded-md bg-red-50 px-3 py-2 text-sm text-red-700 dark:bg-red-950 dark:text-red-300">
                                    {errorMessage}
                                </p>
                            )}

                            <div className="space-y-1">
                                <label htmlFor="name" className="block text-sm font-medium">サービス名</label>
                                <input
                                    id="name"
                                    name="name"
                                    placeholder="Netflix"
                                    value={form.name}
                                    onChange={(e) => setForm({ ...form, name: e.target.value })}
                                    className="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-gray-700"
                                />
                                {errorOf("name") && <p className="text-sm text-red-600 dark:text-red-400">{errorOf("name")}</p>}
                            </div>

                            <div className="space-y-1">
                                <label htmlFor="amount" className="block text-sm font-medium">金額（円）</label>
                                <input
                                    id="amount"
                                    name="amount"
                                    type="number"
                                    min="0"
                                    placeholder="1590"
                                    value={form.amount}
                                    onChange={(e) => setForm({ ...form, amount: e.target.value })}
                                    className="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-gray-700"
                                />
                                {errorOf("amount") && <p className="text-sm text-red-600 dark:text-red-400">{errorOf("amount")}</p>}
                            </div>

                            <div className="space-y-1">
                                <label htmlFor="registeredOn" className="block text-sm font-medium">登録日</label>
                                <input
                                    id="registeredOn"
                                    name="registeredOn"
                                    type="date"
                                    value={form.registeredOn}
                                    onChange={(e) => setForm({ ...form, registeredOn: e.target.value })}
                                    className="w-full rounded-md border border-gray-300 bg-transparent px-3 py-2 focus:border-blue-500 focus:outline-none focus:ring-2 focus:ring-blue-500/30 dark:border-gray-700"
                                />
                                {errorOf("registeredOn") && <p className="text-sm text-red-600 dark:text-red-400">{errorOf("registeredOn")}</p>}
                            </div>

                            <div className="flex justify-end gap-2">
                                <button
                                    type="button"
                                    onClick={closeModal}
                                    className="rounded-md border border-gray-300 px-4 py-2 text-sm hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-900"
                                >
                                    キャンセル
                                </button>
                                <button
                                    disabled={saving}
                                    className="rounded-md bg-blue-600 px-4 py-2 text-sm font-medium text-white hover:bg-blue-700 disabled:cursor-not-allowed disabled:opacity-60"
                                >
                                    {saving ? '保存中...' : editingId ? '保存' : '作成'}
                                </button>
                            </div>
                        </form>
                    </div>
                }

                {/* 一覧：0件なら案内、あればカードを並べる */}
                {subList.length === 0 ? (
                    <p className="rounded-xl border border-dashed border-gray-300 p-8 text-center text-sm text-gray-500 dark:border-gray-700">
                        まだサブスクが登録されていません
                    </p>
                ) : (
                    <ul className="space-y-3">
                        {subList.map((s) => (
                            <li
                                key={s.id}
                                className="flex items-center justify-between rounded-xl border border-gray-200 p-4 shadow-sm dark:border-gray-800"
                            >
                                <div>
                                    <p className="font-medium">{ s.name }</p>
                                    <p className="text-sm text-gray-500">{ formatDate(s.registeredOn) }</p>
                                </div>
                                <div className="flex items-center gap-3">
                                    <p className="text-lg font-bold">¥{ s.amount.toLocaleString('ja-JP') }</p>
                                    <button
                                        onClick={() => openEdit(s)}
                                        className="rounded-md border border-gray-300 px-3 py-1.5 text-sm hover:bg-gray-100 dark:border-gray-700 dark:hover:bg-gray-900"
                                    >
                                        編集
                                    </button>
                                    <button
                                        onClick={() => deleteSubsc(s)}
                                        className="rounded-md border border-red-300 px-3 py-1.5 text-sm text-red-600 hover:bg-red-50 dark:border-red-800 dark:text-red-400 dark:hover:bg-red-950"
                                    >
                                        削除
                                    </button>
                                </div>
                            </li>
                        ))}
                    </ul>
                )}
            </main>
        </div>
    )
}