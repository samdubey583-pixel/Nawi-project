import 'dotenv/config';
import express from 'express';
import cors from 'cors';
import cookieParser from 'cookie-parser';
import mongoose from 'mongoose';
import { connectDatabase } from './config/database.js';
import { validateRuntimeEnvironment } from './config/runtimeEnvironment.js';
import { authRouter } from './routes/auth.js';
import { adminRouter } from './routes/admin.js';
import { testReportsRouter } from './routes/testReports.js';
import { instrumentsRouter } from './routes/instruments.js';
import { dashboardRouter } from './routes/dashboard.js';
import { evidenceRouter } from './routes/evidence.js';
import { reviewerRouter } from './routes/reviewer.js';
import { resolveEvidenceCaptureBaseUrl } from './services/evidenceSession.js';

const app = express();
const port = Number(process.env.PORT || 4000);
let detectedCaptureOrigin = '';
try {
  detectedCaptureOrigin = resolveEvidenceCaptureBaseUrl();
} catch {
  // A missing LAN interface is reported when a QR session is requested; it
  // should not prevent the API from starting for ordinary desktop use.
}
const allowedOrigins = [process.env.CLIENT_URL, process.env.MOBILE_CAPTURE_BASE_URL, process.env.VITE_PUBLIC_APP_URL, detectedCaptureOrigin]
  .flatMap(value => String(value || '').split(','))
  .map(value => value.trim().replace(/\/$/, ''))
  .filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    // Same-origin/proxied requests do not include Origin. Direct browser requests
    // are limited to the explicitly configured desktop/LAN origins.
    if (!origin || allowedOrigins.includes(origin)) return callback(null, true);
    return callback(new Error('Origin is not allowed by the configured NAWI CORS policy.'));
  },
  credentials: true,
}));
app.use(express.json({ limit: '8mb' }));
app.use(cookieParser());
app.get('/api/health', (_, res) => {
  const ready = mongoose.connection.readyState === 1;
  res.status(ready ? 200 : 503).json({ ok: ready, database: ready ? 'connected' : 'unavailable' });
});
app.use('/api/auth', authRouter);
app.use('/api/admin', adminRouter);
app.use('/api/dashboard', dashboardRouter);
app.use('/api/instruments', instrumentsRouter);
app.use('/api/test-reports', testReportsRouter);
app.use('/api/reviewer', reviewerRouter);
app.use('/api', evidenceRouter);
app.use((err: any, _req: any, res: any, _next: any) => {
  console.error(err);
  const zodMessage = err?.name === 'ZodError' ? err.issues?.[0]?.message || 'Please check the submitted fields.' : undefined;
  const body: any = { message: zodMessage || err?.message || 'Something went wrong. Please try again.' };
  if (err?.code) body.code = err.code;
  if (err?.fields) body.fields = err.fields;
  res.status(err?.status || (err?.name === 'ZodError' ? 400 : 500)).json(body);
});

try {
  validateRuntimeEnvironment();
} catch (err) {
  console.error('Invalid production configuration:', (err as Error).message);
  process.exit(1);
}

connectDatabase()
  .then(() => { app.listen(port, '0.0.0.0', () => console.log(`API listening on ${port}`)); })
  .catch(err => { console.error('MongoDB connection failed:', err.message); process.exit(1); });
