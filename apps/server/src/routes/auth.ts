import express from 'express';
import { SignupSchema,LoginSchema } from '@subs/shared/schemas';
import { signup_process,login_process } from '../services/auth';
import { createSession,SESSION_DURATION_MS } from '../services/session';

export const authRouter = express.Router();
export const COOKIE_NAME = '__Host-sid';


const SIGNUP_ACCEPTED_MESSAGE = '確認メールを送信しました'
const LOGIN_SUCCESS_MESSAGE = 'ログインしました';
const ERROR_401 = 'メールアドレスまたはパスワードに誤りがあります'

authRouter.post('/signup', async (req, res) => {
    // @subs/shared/schemasにてexportしたSignupSchemaを用いたバリデーションチェック
    const siginup_typpe_inspection = SignupSchema.safeParse(req.body);
    // バリデーションチェックにてエラーが出た場合の処理
    if (!siginup_typpe_inspection.success){
        const errors = siginup_typpe_inspection.error.issues.map((issue) => ({
            field: issue.path.join('.'),
            message: issue.message,
        }));
        
        // ステータスコード422を指定してレスポンス送信
        return res.status(422).json({
            title: '入力内容に誤りがあります',
            status: 422,
            code: 'VALIDATION_ERROR',
            errors,
        });
    }
    await signup_process(siginup_typpe_inspection.data.email,siginup_typpe_inspection.data.password);
    
    res.status(202).json({
        status:202,
        message: SIGNUP_ACCEPTED_MESSAGE
    });
})

authRouter.post('/login', async (req, res) => {
    // @subs/shared/schemasにてexportしたLoginSchemaを用いたバリデーションチェック
    const login_type_inspection = LoginSchema.safeParse(req.body);
    // バリデーションチェックにてエラーが出た場合の処理
    if(!login_type_inspection.success) {
        const errors = login_type_inspection.error.issues.map((issue) => ({
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
    
    const login = await login_process(login_type_inspection.data.email,login_type_inspection.data.password);
    if (login) {
        const token = await createSession(login.id);
        res.cookie(COOKIE_NAME,token,{ path: '/',httpOnly:true, secure:true, sameSite:'lax', maxAge: SESSION_DURATION_MS})
        return res.status(200).json({
            status:200,
            message: LOGIN_SUCCESS_MESSAGE,
        })
    } else {
        return res.status(401).json({
            title: ERROR_401,
            status: 401,
            code: 'INVALID_CREDENTIALS',
        })
    }
});