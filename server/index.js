import { env, assertEnv } from './src/config/env.js';
import { connectDb } from './src/config/db.js';
import { createApp } from './src/app.js';

try {
  assertEnv();
  await connectDb();
  createApp().listen(env.port, () => console.log(`API listening on http://localhost:${env.port}`));
} catch (err) {
  console.error('Failed to start server:', err.message);
  process.exit(1);
}
