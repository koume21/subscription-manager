import express from 'express';
import { APP_NAME } from '@subs/shared/schemas';
import { errorHandler  } from './middlewares/errorHandler';
import { authRouter } from './routes/auth';
import { requireAuth } from './middlewares/requireAuth';
import cookieParser from 'cookie-parser';

const app = express();
app.use(express.json());
app.use(cookieParser());

// 動作確認用
app.get('/api/v1/ping', (_req, res) => {
  res.json({ message: `${APP_NAME} API is running` });
});

// authのルート設定
app.use('/api/v1/auth', authRouter);

// 動作確認用
app.get('/api/v1/me', requireAuth, (_req, res) => {
  res.json(res.locals.user);
});

// middlewaresによるエラー処理
app.use(errorHandler);

// サーバー起動
app.listen(4000, () => {
  console.log('API サーバー起動: http://localhost:4000');
});
