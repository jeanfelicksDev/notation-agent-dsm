import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

const prismaClientSingleton = () => {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL manquant dans .env')

  const pool = new Pool({
    connectionString: url,
    ssl: url.includes('localhost') ? false : { rejectUnauthorized: false },
    max: process.env.NODE_ENV === 'production' ? 20 : 10,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 5000,
  })
  const adapter = new PrismaPg(pool)
  return new PrismaClient({ adapter })
}

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

export default prisma
export { Prisma } from '@prisma/client'


if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma