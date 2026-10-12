import express from 'express';
import { APP_NAME,SignupSchema } from '@subs/shared/schemas';
import { hashPassword} from './lib/password'
import { prisma } from './lib/prisma';
import { Prisma } from './generated/prisma/client';


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
  const type_inspection = SignupSchema.safeParse(req.body);
  // バリデーションチェックにてエラーが出た場合の処理
  if (!type_inspection.success){
    const errors = type_inspection.error.issues.map((issue) => ({
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
    const passwordHash = await hashPassword(type_inspection.data.password);
    // 重複emailの確認
    const existingUser = await prisma.user.findUnique({
      where: { email: type_inspection.data.email}
    });
    if(existingUser){
      console.log('既に登録済みのユーザーです');
      // メールアドレスの列挙を防ぐために202で返す
      return res.status(202).json({message: SIGNUP_ACCEPTED_MESSAGE })
    }

    await prisma.user.create({
      data: {
        email:        type_inspection.data.email,
        passwordHash: passwordHash
      },
    });
    return res.status(202).json({message: SIGNUP_ACCEPTED_MESSAGE })
  } catch (error) {
    
    if (error instanceof Prisma.PrismaClientKnownRequestError && error.code === 'P2002') {
      return res.status(202).json({message: SIGNUP_ACCEPTED_MESSAGE })
    }
    console.error(error);
    return res.status(500).json({
      title: 'サーバーでエラーが発生しました',
      status: 500,
      code: 'INTERNAL_ERROR',
    });
  }
});


// サーバー起動
app.listen(4000, () => {
  console.log('API サーバー起動: http://localhost:4000');
});
