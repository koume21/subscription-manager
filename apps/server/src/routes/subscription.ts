import express from "express";
import type { Response } from "express";
import { CreateSubscriptionSchema, UpdateSubscriptionSchema, SubscriptionIdSchema } from "@subs/shared/schemas";
import { requireAuth } from "../middlewares/requireAuth";
import { subscriptionList, createSubsc, updateSubsc, deleteSubsc, SUBSCRIPTION_LIMIT } from "../services/subscription";

export const subscriptionRouter = express.Router()

const response_404 = {
    title: 'サブスクが見つかりません',
    status: 404,
    code: 'NOT_FOUND',
}

// zod の safeParse が失敗したときの error のうち、使う部分だけの型
type ValidationError = { issues: { path: PropertyKey[]; message: string }[] };

// バリデーションエラーを 422 で返す（routes/auth.ts と同じ形）
function sendValidationError(res: Response, error: ValidationError) {
    const errors = error.issues.map((issue) => ({
        field: issue.path.join('.'),
        message: issue.message,
    }));
    return res.status(422).json({
        title: '入力内容に誤りがあります',
        status: 422,
        code: 'VALIDATION_ERROR',
        errors,
    });
}

// 一覧
subscriptionRouter.get('/', requireAuth, async(req, res) => {
    const userId = res.locals.user.id
    const subscriptionsList = await subscriptionList(userId)
    res.status(200).json(subscriptionsList) ;
})

// 登録
subscriptionRouter.post('/', requireAuth, async(req, res) => {
    const parsed = CreateSubscriptionSchema.safeParse(req.body);
    if (!parsed.success) {
        return sendValidationError(res, parsed.error);
    }

    const userId = res.locals.user.id;
    const created = await createSubsc(userId, parsed.data);
    if (!created) {
        return res.status(422).json({
            title: `登録できるサブスクは${SUBSCRIPTION_LIMIT}件までです`,
            status: 422,
            code: 'SUBSCRIPTION_LIMIT_EXCEEDED',
        });
    }
    return res.status(201).json(created);
})

// 編集
subscriptionRouter.patch('/:id', requireAuth, async(req, res) => {
    // uuid の形でない id は、DB に問い合わせる前に 404 にする
    const id = SubscriptionIdSchema.safeParse(req.params.id);
    if (!id.success) {
        return res.status(404).json(response_404);
    }

    const parsed = UpdateSubscriptionSchema.safeParse(req.body);
    if (!parsed.success) {
        return sendValidationError(res, parsed.error);
    }

    const userId = res.locals.user.id;
    const updated = await updateSubsc(userId, id.data, parsed.data);
    if (!updated) {
        return res.status(404).json(response_404);
    }
    return res.status(200).json(updated);
})

// 削除
subscriptionRouter.delete('/:id', requireAuth, async(req, res) => {
    const id = SubscriptionIdSchema.safeParse(req.params.id);
    if (!id.success) {
        return res.status(404).json(response_404);
    }

    const userId = res.locals.user.id;
    const deleted = await deleteSubsc(userId, id.data);
    if (!deleted) {
        return res.status(404).json(response_404);
    }
    return res.status(204).end();
})
