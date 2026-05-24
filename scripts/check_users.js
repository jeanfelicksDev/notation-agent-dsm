const { PrismaClient } = require('@prisma/client');
const { PrismaLibSql } = require('@prisma/adapter-libsql');

const adapter = new PrismaLibSql({
  url: 'file:dev.db',
});

const prisma = new PrismaClient({ adapter });

async function main() {
  const users = await prisma.utilisateur.findMany();
  console.log('Users found:', JSON.stringify(users, null, 2));
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
