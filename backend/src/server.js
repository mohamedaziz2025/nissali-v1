import { connectDb } from './config/db.js';
import { env } from './config/env.js';
import { createApp } from './app.js';
import { startScheduler } from './jobs/scheduler.js';
import { watchMailer } from './services/mailer.js';
import { ensureTrialPlan } from './services/marketplace.js';
import { runStartupMigrations } from './services/migrations.js';

async function main() {
  await connectDb();
  await ensureTrialPlan().catch((e) => console.error('[api] essai gratuit :', e.message));
  await runStartupMigrations();
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
