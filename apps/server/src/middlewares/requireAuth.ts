import type { Request, Response, NextFunction } from 'express';
import { COOKIE_NAME,validateSession } from '../services/session';

const response_401 = {
    title: 'ログインしてください',
    status: 401,
    code: 'UNAUTHENTICATED',
}

export async function requireAuth(req: Request, res: Response, next:NextFunction) {
    // cookieのtokenを取得
    const cookieToken = req.cookies[COOKIE_NAME];
    // トークンが存在しなかった場合の処理(未ログイン)
    if(!cookieToken) {
        return res.status(401).json(response_401);
    }
    // cookieのユーザー取得
    const sessionUser = await validateSession(cookieToken);
    if(!sessionUser){
        return res.status(401).json(response_401);
    }
    res.locals.user = sessionUser;
    next();
}