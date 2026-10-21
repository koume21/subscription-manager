import { prisma } from "../lib/prisma";
import { Prisma } from "../generated/prisma/client";
import type { CreateSubscriptionInput, UpdateSubscriptionInput } from "@subs/shared/schemas";

// 1 ユーザーが登録できるサブスクの上限（docs/01_requirements.md F-SUB-08）
export const SUBSCRIPTION_LIMIT = 200;

// レスポンスで返す項目。一覧・登録・編集で同じ形にそろえる
const subscriptionSelect = {
    id: true,
    name: true,
    amount: true,
    registeredOn: true,
    user: { select: { email: true }}
} satisfies Prisma.SubscriptionSelect;

// "2026-10-01" → Date。null は null のまま、undefined（送られていない）は undefined のまま
function toDate(value: string | null | undefined) {
    if (value === undefined) return undefined;
    if (value === null) return null;
    return new Date(value);
}

export async function subscriptionList (userId: string) {
    // ログインユーザーのサブスク登録情報を取得
    const subscriptions = await prisma.subscription.findMany({
        where: { userId },
        select: subscriptionSelect,
    })
    return subscriptions;
}

// 登録。上限に達していたら null を返す
export async function createSubsc(userId: string, input: CreateSubscriptionInput) {
    const count = await prisma.subscription.count({ where: { userId } });
    if (count >= SUBSCRIPTION_LIMIT) {
        return null;
    }

    return prisma.subscription.create({
        data: {
            userId,
            name: input.name,
            amount: input.amount,
            registeredOn: toDate(input.registeredOn),
        },
        select: subscriptionSelect,
    });
}

// 編集。自分のサブスクでなければ（見つからなければ）null を返す
export async function updateSubsc(userId: string, id: string, input: UpdateSubscriptionInput) {
    try {
        return await prisma.subscription.update({
            // id だけでなく userId も条件に入れて、他人のサブスクを更新できないようにする
            where: { id, userId },
            data: {
                name: input.name,
                amount: input.amount,
                registeredOn: toDate(input.registeredOn),
            },
            select: subscriptionSelect,
        });
    } catch (err) {
        // P2025：更新する行が見つからなかった
        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2025') {
            return null;
        }
        throw err;
    }
}

// 削除。消せたら true、自分のサブスクでなければ（見つからなければ）false を返す
export async function deleteSubsc(userId: string, id: string) {
    const result = await prisma.subscription.deleteMany({
        where: { id, userId },
    });
    return result.count > 0;
}
