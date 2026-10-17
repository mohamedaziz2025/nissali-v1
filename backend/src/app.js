import path from 'node:path';
import cookieParser from 'cookie-parser';
import cors from 'cors';
import express from 'express';
import helmet from 'helmet';
import { env } from './config/env.js';
import { authenticate } from './middleware/auth.js';
import { ClientRecord } from './models/index.js';
import { readChatImageToken, readFileToken } from './services/session.js';
import { errorHandler, notFoundHandler } from './middleware/error.js';
import adminRoutes from './routes/admin.js';
import adminContentRoutes from './routes/adminContent.js';
import eventRoutes from './routes/events.js';
import messageRoutes from './routes/messages.js';
import mosqueRoutes from './routes/mosques.js';
import appointmentRoutes from './routes/appointments.js';
import authRoutes from './routes/auth.js';
import blogRoutes from './routes/blog.js';
import cycleRoutes from './routes/cycle.js';
import fastRoutes from './routes/fasts.js';
import geoRoutes from './routes/geo.js';
import healthRoutes from './routes/health.js';
import meRoutes from './routes/me.js';
import notificationRoutes from './routes/notifications.js';
import practitionerRoutes from './routes/practitioners.js';
import prayerRoutes from './routes/prayers.js';
import pregnancyRoutes from './routes/pregnancy.js';
import proRoutes from './routes/pro.js';
import stripeRoutes from './routes/stripe.js';
import todayRoutes from './routes/today.js';

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  app.disable('x-powered-by');
  app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' } }));
  app.use(
    cors({
      // L'app mobile (Expo) n'envoie pas d'en-tête Origin ; les apps web sont listées dans CORS_ORIGINS.
      origin: (origin, cb) => cb(null, !origin || env.corsOrigins.includes(origin) || !env.isProd),
      credentials: true,
    }),
  );
  // Webhook Stripe : monté avant express.json pour recevoir le corps brut (signature).
  app.use('/api/stripe', stripeRoutes);
  app.use(express.json({ limit: '1mb' }));
  app.use(cookieParser());
  app.use('/uploads', express.static(path.resolve(env.uploadDir), { maxAge: '7d' }));
  // 14 — photos de couverture des articles livrées avec l'appli (remplaçables dans le back-office).
  app.use('/covers', express.static(path.resolve('src/content/covers'), { maxAge: '30d' }));
  app.use(authenticate);

  app.get('/api/health', (_req, res) => res.json({ ok: true, service: 'nissali-api', time: new Date().toISOString() }));
  // Document privé via lien temporaire signé (ouverture depuis l'app mobile).
  app.get('/api/files/:token', async (req, res) => {
    const payload = await readFileToken(req.params.token);
    if (!payload) return res.status(403).json({ error: 'Lien expiré', code: 'LINK_EXPIRED' });
    const record = await ClientRecord.findById(payload.r).select('files').lean();
    const file = record?.files?.find((f) => String(f._id) === payload.f);
    if (!file) return res.status(404).json({ error: 'Document introuvable', code: 'NOT_FOUND' });
    res.setHeader('Content-Type', file.mime || 'application/octet-stream');
    res.setHeader('Content-Disposition', `inline; filename*=UTF-8''${encodeURIComponent(file.name)}`);
    res.setHeader('Cache-Control', 'private, no-store');
    return res.sendFile(path.join(path.resolve(env.privateDir), file.storedName));
  });
  // Photos de la messagerie : stockage privé, lien signé valable 2 h.
  app.get('/api/chat-images/:token', async (req, res) => {
    const name = await readChatImageToken(req.params.token);
    if (!name || !/^[a-f0-9]{32}\.(jpg|jpeg|png|webp)$/.test(name)) return res.status(403).json({ error: 'Lien expiré', code: 'LINK_EXPIRED' });
    res.setHeader('Cache-Control', 'private, max-age=3600');
    return res.sendFile(path.join(path.resolve(env.privateDir), 'chat', name), (err) => err && !res.headersSent && res.status(404).end());
  });
  app.use('/api/auth', authRoutes);
  app.use('/api/me', meRoutes);
  app.use('/api/today', todayRoutes);
  app.use('/api/cycle', cycleRoutes);
  app.use('/api/health-log', healthRoutes);
  app.use('/api/prayers', prayerRoutes);
  app.use('/api/fasts', fastRoutes);
  app.use('/api/pregnancy', pregnancyRoutes);
  app.use('/api/appointments', appointmentRoutes);
  app.use('/api/blog', blogRoutes);
  app.use('/api/geo', geoRoutes);
  app.use('/api/notifications', notificationRoutes);
  app.use('/api/practitioners', practitionerRoutes);
  app.use('/api/pro', proRoutes);
  app.use('/api/admin', adminRoutes);
  app.use('/api/admin', adminContentRoutes);
  app.use('/api/messages', messageRoutes);
  app.use('/api/events', eventRoutes);
  app.use('/api/mosques', mosqueRoutes);

  app.use(notFoundHandler);
  app.use(errorHandler);
  return app;
}
