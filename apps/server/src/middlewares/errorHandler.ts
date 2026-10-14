import type { Request, Response, NextFunction } from 'express'; 

export function errorHandler(err: unknown, _req: Request, res: Response, _next:NextFunction){
    if (err instanceof SyntaxError &&  'type' in err && err.type === 'entity.parse.failed') {
        return res.status(400).json({
            title: '壊れたJSONです',
            status: 400,
            code: 'INVALID_JSON',
        });
    }

    console.error(err);
    return res.status(500).json({
        title: 'サーバーでエラーが発生しました',
        status: 500,
        code: 'INTERNAL_ERROR',
    });
}

