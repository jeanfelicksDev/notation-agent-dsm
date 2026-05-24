const { PrismaClient } = require('@prisma/client');
const { PrismaLibSql } = require('@prisma/adapter-libsql');

const adapter = new PrismaLibSql({
  url: 'file:dev.db',
});

const prisma = new PrismaClient({ adapter });

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
      email: 'admin@dsm.ci',
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
