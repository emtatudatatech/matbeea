import 'dotenv/config';
import path from 'node:path';
import { defineConfig, env } from 'prisma/config';

// Prisma 7 moves the connection URL out of schema.prisma and into this file.
// Only the CLI (migrate / db push / studio) reads it — the runtime client
// connects through the Neon driver adapter in prisma/client.ts instead.
export default defineConfig({
  schema: path.join('prisma', 'schema.prisma'),
  datasource: {
    url: env('DATABASE_URL'),
  },
});
