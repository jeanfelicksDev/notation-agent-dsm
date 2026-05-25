const { PrismaClient } = require('@prisma/client');

function createPrisma() {
  const url = process.env.DATABASE_URL || 'file:dev.db';

  if (url.startsWith('postgresql://') || url.startsWith('postgres://')) {
    const { PrismaPg } = require('@prisma/adapter-pg');
    return new PrismaClient({ adapter: new PrismaPg({ connectionString: url }) });
  }

  const { PrismaLibSql } = require('@prisma/adapter-libsql');
  return new PrismaClient({ adapter: new PrismaLibSql({ url }) });
}

const prisma = createPrisma();

async function main() {
  console.log('Seeding database...');

  // Create Site
  const site = await prisma.site.upsert({
    where: { nom: 'Siège Social' },
    update: {},
    create: {
      nom: 'Siège Social',
      ville: 'Abidjan',
    },
  });

  // Create Admin User
  const admin = await prisma.utilisateur.upsert({
    where: { matricule: 'ADM-001' },
    update: {},
    create: {
      matricule: 'ADM-001',
      nom: 'ADMIN',
      prenom: 'System',
      email: 'jeanfelicks11@gmail.com',
      motDePasse: 'admin123', // In a real app, hash this!
      role: 'ADMIN',
      siteId: site.id,
    },
  });

  console.log('Admin user created:', admin.matricule);
  console.log('Seeding completed.');
  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
