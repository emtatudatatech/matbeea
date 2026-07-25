import { PrismaClient } from '@prisma/client';
import { PrismaNeon } from '@prisma/adapter-neon';

// Prisma 7 no longer reads the connection URL from schema.prisma; the runtime
// client must be handed a driver adapter. PrismaNeon wraps @neondatabase/serverless,
// which talks to Neon over WebSockets instead of raw TCP — the right transport for
// short-lived serverless invocations against a scale-to-zero database.
const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error('DATABASE_URL is not set. Add it to .env.local (see README).');
}

const globalForPrisma = global as unknown as { prisma?: PrismaClient };

const createPrismaClient = () =>
  new PrismaClient({ adapter: new PrismaNeon({ connectionString }) });

export const prisma = globalForPrisma.prisma ?? createPrismaClient();

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma;

export default prisma;
