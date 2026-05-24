const { PrismaClient } = require('@prisma/client');
const { PrismaLibSql } = require('@prisma/adapter-libsql');

const adapter = new PrismaLibSql({
  url: 'file:prisma/dev.db',
});

const prisma = new PrismaClient({ adapter });

async function main() {
  try {
    const campaigns = await prisma.campagne.findMany({ take: 1 });
    console.log('Campaigns found:', campaigns.length);
    if (campaigns.length > 0) {
      console.log('ID:', campaigns[0].id, 'Libelle:', campaigns[0].libelle);
    }
  } catch (err) {
    console.error('Prisma Error:', err);
  } finally {
    await prisma.$disconnect();
  }
}

main();
