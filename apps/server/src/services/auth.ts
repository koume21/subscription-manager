import { prisma } from '../lib/prisma';
import { hashPassword,verifyPassword } from '../lib/password';
import { Prisma } from '../generated/prisma/client';
const dummyHash = hashPassword("dummyPassword"); //ダミーのパスワードのハッシュ化

export async function signup_process(email:string,password:string) {
    try {
        // チェックしたデータからpasswordを取得
        // パスワードのハッシュ化処理(../lib/password)
        const passwordHash = await hashPassword(password);
        // 重複emailの確認
        const existingUser = await prisma.user.findUnique({
            where: { email }
        });
        if(existingUser){
            console.log('既に登録済みのユーザーです');
            // メールアドレスの列挙を防ぐために202で返す
            return;
        }

        await prisma.user.create({
            data: {
            email,
            passwordHash: passwordHash
            },
        });
        return;
    } catch (err) {

        if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === 'P2002') {
            return;
        }
        throw err;
    }
}

export async function login_process(email:string,password:string) {
    // 入力されたメールアドレスからメールアドレス、ハッシュ化されたパスワードの取得
    const search_user = await prisma.user.findUnique({
        where: {email },
        select: { id: true,
                email: true,
                passwordHash: true,
        }
    });
    // メールアドレスが見つからなかった場合の処理
    if(!search_user) {
        // エラー時でも処理速度を合わせるためにverifyPasswordを実行
        await verifyPassword(password,await dummyHash);
        return;
        
    }
    // パスワード比較
    const password_judement = await verifyPassword(password,search_user.passwordHash);
    if (password_judement) {
        const { passwordHash, ...userWithoutPassword } = search_user;
        return userWithoutPassword;
    } else {
        return;
    }
}