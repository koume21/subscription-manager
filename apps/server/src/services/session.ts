import { generateToken,hashToken } from "../lib/token";
import { prisma } from "../lib/prisma";

export const SESSION_DURATION_MS = 24 * 30 * 60 * 60 * 1000;
export const COOKIE_NAME = '__Host-sid';

export async function createSession(userId:string) {
    // tokenを生成
    const token = generateToken();
    // tokenのhash化
    const tokenHash = hashToken(token);
    // セッションの有効時間
    const oneMonthLater = new Date(Date.now() + SESSION_DURATION_MS);
    await prisma.session.create({
        data: {
            id: tokenHash,
            userId,
            expiresAt: oneMonthLater,
        },
    });
    return token;
}

export async function validateSession(token:string) {
    const tokenHash = hashToken(token);
    const searchSession = await prisma.session.findUnique({
        where: { id: tokenHash },
        select: {
            id: true,
            user: {
                select: {id:true, email:true}
            },
            expiresAt: true,
        }
    });
    if(!searchSession) return;
    if(Date.now() > searchSession.expiresAt.getTime()) {
        await prisma.session.delete({
            where: {id: tokenHash},
        });
        return;
    }
    return searchSession.user;

}