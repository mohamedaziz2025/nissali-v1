// MongoDB local sans installation (mongodb-memory-server), avec données conservées sur disque.
// Usage : npm run db:local   → mongodb://127.0.0.1:27017/nissali
import fs from 'node:fs';
import path from 'node:path';
import { MongoMemoryServer } from 'mongodb-memory-server';

const dbPath = path.resolve(process.env.LOCAL_MONGO_PATH || '.data/db');
fs.mkdirSync(dbPath, { recursive: true });
const port = Number(process.env.LOCAL_MONGO_PORT || 27017);

// MongoDB 7.0 reste compatible macOS 11+ (la 8.x exige macOS 13+).
const version = process.env.MONGOMS_VERSION || '7.0.14';

const server = await MongoMemoryServer.create({
  binary: { version },
  instance: { dbPath, port, storageEngine: 'wiredTiger', ip: '127.0.0.1' },
});
console.log(`[mongo] MongoDB local prêt : ${server.getUri()}nissali`);
console.log(`[mongo] données : ${dbPath} — Ctrl+C pour arrêter`);

const stop = async () => {
  await server.stop({ doCleanup: false });
  process.exit(0);
};
process.on('SIGINT', stop);
process.on('SIGTERM', stop);
