import mongoose from 'mongoose';

export function resolveMongoUri(env: NodeJS.ProcessEnv = process.env) {
  const uri = String(env.MONGODB_URI || '').trim();
  if (String(env.NODE_ENV || '').toLowerCase() === 'production' && !uri) {
    throw new Error('MONGODB_URI must be explicitly configured in production.');
  }
  return uri || 'mongodb://127.0.0.1:27017/nawi-test-report';
}

export function connectDatabase() {
  const uri = resolveMongoUri();
  return mongoose.connect(uri);
}
