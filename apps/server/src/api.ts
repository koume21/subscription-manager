import express from 'express';
import { APP_NAME,SignupSchema,LoginSchema } from '@subs/shared/schemas';
import { hashPassword,verifyPassword } from './lib/password'
import { prisma } from './lib/prisma';
import { Prisma } from './generated/prisma/client';


const dummyHash = hashPassword("dummyPassword"); //ダミーのパスワードのハッシュ化

const app = express();
app.use(express.json());

// 動作確認用
app.get('/api/v1/ping', (_req, res) => {
  res.json({ message: `${APP_NAME} API is running` });
});

// 新規登録API
app.post('/api/v1/auth/signup', async (req, res) => {
  const SIGNUP_ACCEPTED_MESSAGE = '確認メールを送信しました'
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
    })
  }
  
  try {
    // チェックしたデータからpasswordを取得
    // パスワードのハッシュ化処理(./lib/password)
    const passwordHash = await hashPassword(siginup_typpe_inspection.data.password);
    // 重複emailの確認
    const existingUser = await prisma.user.findUnique({
      where: { email: siginup_typpe_inspection.data.email}
    });
    if(existingUser){
      console.log('既に登録済みのユーザーです');
      // メールアドレスの列挙を防ぐために202で返す
      return res.status(202).json({
        status:202,
        message: SIGNUP_ACCEPTED_MESSAGE
      })
    }

    await prisma.user.create({
      data: {
        email:        siginup_typpe_inspection.data.email,
        passwordHash: passwordHash
      },
    });
    return res.status(202).json({
      status:202,
      message: SIGNUP_ACCEPTED_MESSAGE
    })
  } catch (error) {
    
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(202).json({
        status:202,
        message: SIGNUP_ACCEPTED_MESSAGE
      })
    }
    //errorログ出力
    console.error(error);

    return res.status(500).json({
      title: 'サーバーでエラーが発生しました',
      status: 500,
      code: 'INTERNAL_ERROR',
    });
  }
});





// ログインAPI
app.post('/api/v1/auth/login',async (req, res) => {
  const LOGIN_SUCCESS_MESSAGE = 'ログインしました';
  const ERROR_401 = 'メールアドレスまたはパスワードに誤りがあります'
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
  
  try {
    // 入力されたメールアドレスからメールアドレス、ハッシュ化されたパスワードの取得
    const search_user = await prisma.user.findUnique({
      where: {email: login_type_inspection.data.email },
      select: { id: true,
                email: true,
                passwordHash: true,
      }
    });
    // メールアドレスが見つからなかった場合の処理
    if(!search_user) {
      // エラー時でも処理速度を合わせるためにverifyPasswordを実行
      await verifyPassword(login_type_inspection.data.password,await dummyHash);
      return res.status(401).json({
        title: ERROR_401,
        status: 401,
        code: 'INVALID_CREDENTIALS',
      });
    }
    // パスワード比較
    const password_judement = await verifyPassword(login_type_inspection.data.password,search_user.passwordHash);
    if (password_judement) {
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
  } catch(error) {
    console.error(error);

    return res.status(500).json({
      title: 'サーバーでエラーが発生しました',
      status: 500,
      code: 'INTERNAL_ERROR',
    });
  }
})


// サーバー起動
app.listen(4000, () => {
  console.log('API サーバー起動: http://localhost:4000');
});
