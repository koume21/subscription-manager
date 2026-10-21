import { z } from "zod";

// アプリ名
export const APP_NAME = 'サブスク管理';

// 新規登録時のバリデーションチェック
export const SignupSchema = z.object({
    email:     z.email("正しいメールアドレスを入力してください"),
    password:  z.string("文字列を入力してください")
                .min(8,"8文字以上で入力してください")
                .max(128,"128文字以下で入力してください")
});

export const LoginSchema = z.object({
    email:     z.email("正しいメールアドレスを入力してください"),
    password:  z.string("文字列を入力してください")
                .min(1,"パスワードを入力してください")
});
export type SignupInput = z.infer<typeof SignupSchema>;

// サブスク登録時のバリデーションチェック
export const CreateSubscriptionSchema = z.object({
    name:         z.string("文字列を入力してください")
                    .trim()
                    .min(1,"サービス名を入力してください")
                    .max(100,"100文字以下で入力してください"),
    amount:       z.number("金額を入力してください")
                    .int("整数で入力してください")
                    .min(0,"0円以上で入力してください")
                    .max(10_000_000,"10,000,000円以下で入力してください"),
    registeredOn: z.iso.date("日付の形式が正しくありません").nullable(),
});
export type CreateSubscriptionInput = z.infer<typeof CreateSubscriptionSchema>;

// サブスク編集時のバリデーションチェック（送られてきた項目だけを更新する）
export const UpdateSubscriptionSchema = CreateSubscriptionSchema.partial();
export type UpdateSubscriptionInput = z.infer<typeof UpdateSubscriptionSchema>;

// URL の :id のチェック（DB の id は uuid）
export const SubscriptionIdSchema = z.uuid();
