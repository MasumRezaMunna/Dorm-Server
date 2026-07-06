import express from 'express';
import cors from 'cors';

const app = express();

const ALLOWED_ORIGINS = [
  'http://localhost:5173',
];

app.use(cors({
  origin: ALLOWED_ORIGINS,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE'],
  allowedHeaders: ['Content-Type', 'Authorization'],
}));

app.post('/api/auth/google', (req, res) => res.send('ok'));

app.use((req, res) => {
  console.log('Not found:', req.method, req.url);
  res.status(404).send('Not found');
});

app.listen(3001, () => console.log('started'));
