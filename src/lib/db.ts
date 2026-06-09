import { PrismaClient } from '@prisma/client'
import { join } from 'path'
import { config as dotenvConfig } from 'dotenv'

// Override system env var if it's pointing to wrong DB (e.g. file: SQLite)
// The system may provide a file: SQLite URL while the app needs PostgreSQL
if (process.env.DATABASE_URL?.startsWith('file:')) {
  dotenvConfig({ path: join(process.cwd(), '.env'), override: true });
}

// Safety check: if DATABASE_URL still doesn't look like PostgreSQL, force override
if (!process.env.DATABASE_URL?.startsWith('postgresql://') && !process.env.DATABASE_URL?.startsWith('postgres://')) {
  dotenvConfig({ path: join(process.cwd(), '.env'), override: true });
}

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const db =
  globalForPrisma.prisma ??
  new PrismaClient({
    log: ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = db