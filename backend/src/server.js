import { connectDb } from './config/db.js';
import { env } from './config/env.js';
import { createApp } from './app.js';
import { startScheduler } from './jobs/scheduler.js';
import { watchMailer } from './services/mailer.js';

async function main() {
  await connectDb();
  const app = createApp();
  app.listen(env.port, '0.0.0.0', () => {
    console.log(`[api] Nissali API sur http://localhost:${env.port} (${env.nodeEnv})`);
  });
  if (env.enableJobs) startScheduler();
  watchMailer();
}

main().catch((err) => {
  console.error('[api] démarrage impossible :', err.message);
  if (/ECONNREFUSED|querySrv|Server selection/i.test(err.message)) {
    console.error('→ MongoDB est-il lancé ? En local sans installation : `npm run db:local` dans un autre terminal.');
  }
  process.exit(1);
});
