import dns from 'node:dns';
import mongoose from 'mongoose';
import { env } from './env.js';

// Some home/campus DNS resolvers fail on Atlas SRV lookups; use public resolvers.
dns.setServers(['8.8.8.8', '1.1.1.1']);

export const DEFAULT_DB_NAME = 'smarttea';

/** True when the connection string names no database (e.g. "...mongodb.net/?retryWrites=true"). */
function hasNoDbName(uri) {
  const afterHost = uri.replace(/^mongodb(\+srv)?:\/\/[^/]+/, '');
  return afterHost === '' || afterHost.startsWith('/?') || afterHost === '/';
}

export async function connectDb(uri = env.mongoUri) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 15000,
    ...(hasNoDbName(uri) ? { dbName: DEFAULT_DB_NAME } : {}),
  });
  return mongoose.connection;
}

export async function disconnectDb() {
  await mongoose.disconnect();
}
