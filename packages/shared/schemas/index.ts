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

export type SignupInput = z.infer<typeof SignupSchema>;
