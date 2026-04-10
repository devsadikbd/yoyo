import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import pg from 'pg'

const connectionString = (process.env.DATABASE_URL || '').trim()

if (!connectionString) {
  throw new Error('DATABASE_URL is not set')
}

const pool = new pg.Pool({
  connectionString,
  max: 10,
  idleTimeoutMillis: 30_000,
  connectionTimeoutMillis: 10_000
})

pool.on('error', (err) => {
  console.error('Postgres pool error:', err.message)
})

const adapter = new PrismaPg(pool)

export const prisma = new PrismaClient({ adapter })
