import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import cookieParser from 'cookie-parser';
import { env } from './config/env.js';
import { authenticate } from './middleware/auth.js';
import { errorHandler, notFoundHandler } from './middleware/errors.js';
import authRoutes from './routes/auth.routes.js';
import lookupsRoutes from './routes/lookups.routes.js';
import usersRoutes from './routes/users.routes.js';
import producersRoutes from './routes/producers.routes.js';
import collectionsRoutes from './routes/collections.routes.js';
import dashboardRoutes from './routes/dashboard.routes.js';

const API = '/api/v1';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1); // Render / reverse proxies: needed for secure cookies + rate limit IPs
  app.use(helmet());
  app.use(cors({ origin: env.clientUrl, credentials: true }));
  app.use(express.json({ limit: '100kb' }));
  app.use(cookieParser());

  app.get('/api/health', (req, res) => res.json({ status: 'ok' }));

  // Public (login) – each route in auth.routes.js handles its own session check.
  app.use(`${API}/auth`, authRoutes);

  // Signed-in users only; role checks are inside each router (authorize).
  app.use(`${API}/lookups`, authenticate, lookupsRoutes);
  app.use(`${API}/users`, authenticate, usersRoutes);
  app.use(`${API}/producers`, authenticate, producersRoutes);
  app.use(`${API}/collections`, authenticate, collectionsRoutes);
  app.use(`${API}/dashboard`, authenticate, dashboardRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
