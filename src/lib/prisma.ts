import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const prismaClientSingleton = () => {
  const url = process.env.DATABASE_URL
  if (!url) throw new Error('DATABASE_URL is required')
  const adapter = new PrismaPg({ connectionString: url })
  return new PrismaClient({ adapter })
}

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma