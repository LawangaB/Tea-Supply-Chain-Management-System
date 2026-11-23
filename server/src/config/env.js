import 'dotenv/config';

const isTest = process.env.NODE_ENV === 'test';

export const env = {
  nodeEnv: process.env.NODE_ENV || 'development',
  isProd: process.env.NODE_ENV === 'production',
  isTest,
  port: Number(process.env.PORT) || 5000,
  databaseUrl: process.env.DATABASE_URL, // pooled connection (Neon "-pooler" host) used by the app
  directUrl: process.env.DIRECT_URL, // unpooled connection used by `prisma migrate`
  jwtSecret: process.env.JWT_SECRET || (isTest ? 'test-secret' : undefined),
  jwtExpiresIn: process.env.JWT_EXPIRES_IN || '8h',
  clientUrl: (process.env.CLIENT_URL || 'http://localhost:5173').split(',').map((s) => s.trim()),
};

export function assertEnv() {
  const missing = [];
  if (!env.databaseUrl) missing.push('DATABASE_URL');
  if (!env.jwtSecret) missing.push('JWT_SECRET');
  if (missing.length) {
    throw new Error(`Missing environment variables: ${missing.join(', ')} (see server/.env.example)`);
  }
}
