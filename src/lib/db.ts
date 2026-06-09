import { PrismaClient } from '@prisma/client'
import { join } from 'path'
import { config as dotenvConfig } from 'dotenv'

// Override system env var if it's pointing to wrong DB (e.g. file: SQLite)
if (process.env.DATABASE_URL?.startsWith('file:')) {
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