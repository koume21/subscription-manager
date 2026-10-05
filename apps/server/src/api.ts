import express from 'express';
import { APP_NAME } from '@subs/shared/schemas';

const app = express();

// 動作確認用
app.get('/api/v1/ping', (_req, res) => {
  res.json({ message: `${APP_NAME} API is running` });
});

app.listen(4000, () => {
  console.log('API サーバー起動: http://localhost:4000');
});
