import dns from 'node:dns';
import mongoose from 'mongoose';
import { env } from './env.js';

// Some home/campus DNS resolvers fail on Atlas SRV lookups; use public resolvers.
dns.setServers(['8.8.8.8', '1.1.1.1']);

export async function connectDb(uri = env.mongoUri) {
  mongoose.set('strictQuery', true);
  await mongoose.connect(uri);
  return mongoose.connection;
}

export async function disconnectDb() {
  await mongoose.disconnect();
}
