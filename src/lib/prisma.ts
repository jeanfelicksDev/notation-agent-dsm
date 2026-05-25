import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { PrismaLibSql } from '@prisma/adapter-libsql'

const prismaClientSingleton = () => {
  const url = process.env.DATABASE_URL || 'file:./dev.db'

  if (url.startsWith('postgresql://') || url.startsWith('postgres://')) {
    const adapter = new PrismaPg({ connectionString: url })
    return new PrismaClient({ adapter })
  }

  const adapter = new PrismaLibSql({ url })
  return new PrismaClient({ adapter })
}

declare const globalThis: {
  prismaGlobal: ReturnType<typeof prismaClientSingleton>;
} & typeof global;

const prisma = globalThis.prismaGlobal ?? prismaClientSingleton()

export default prisma

if (process.env.NODE_ENV !== 'production') globalThis.prismaGlobal = prisma