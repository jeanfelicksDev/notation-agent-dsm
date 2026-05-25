const { PrismaClient } = require('@prisma/client');
const { PrismaPg } = require('@prisma/adapter-pg');
const { Pool } = require('pg');

const url = process.env.DATABASE_URL;
if (!url) throw new Error('DATABASE_URL is required');

const pool = new Pool({ connectionString: url, ssl: { rejectUnauthorized: false } });
const prisma = new PrismaClient({ adapter: new PrismaPg(pool) });

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
    where: { matricule: '7453' },
    update: {},
    create: {
      matricule: '7453',
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
