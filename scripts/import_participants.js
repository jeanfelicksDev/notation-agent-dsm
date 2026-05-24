const { PrismaClient } = require('@prisma/client');
const { PrismaLibSql } = require('@prisma/adapter-libsql');
const { createClient } = require('@libsql/client');
const XLSX = require('xlsx');
const path = require('path');

const client = createClient({
  url: 'file:prisma/dev.db',
});
const adapter = new PrismaLibSql(client);
const prisma = new PrismaClient({ adapter });

const filePath = path.join(__dirname, '..', 'ListeAgentsDsm.xlsx');
const workbook = XLSX.readFile(filePath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];

const rows = XLSX.utils.sheet_to_json(sheet);

async function importData() {
  console.log(`Found ${rows.length} rows to process.`);
  
  for (const row of rows) {
    const matricule = row['Matricule']?.toString().trim();
    if (!matricule) continue;

    const nom = row['Nom']?.toString().trim() || '';
    const prenom = row['Prénoms']?.toString().trim() || '';
    const service = row['Service']?.toString().trim() || '';
    const siteNom = row['Site']?.toString().trim() || 'Siège';
    const statusRaw = row['Status (Collègues/Manager/Externe)']?.toString().trim().toUpperCase() || '';

    let role = 'UTILISATEUR';
    if (statusRaw.includes('MANAGER')) role = 'MANAGER';
    else if (statusRaw.includes('EXTERNE') || statusRaw.includes('CLIENT')) role = 'EXTERNE';

    try {
      // Find or create Site
      let site = await prisma.site.findUnique({ where: { nom: siteNom } });
      if (!site) {
        site = await prisma.site.create({ data: { nom: siteNom } });
        console.log(`Created site: ${siteNom}`);
      }

      // Create or update User
      await prisma.utilisateur.upsert({
        where: { matricule },
        update: {
          nom,
          prenom,
          service,
          role,
          siteId: site.id
        },
        create: {
          matricule,
          nom,
          prenom,
          email: `${matricule.toLowerCase()}@dsm.com`, // Placeholder email
          motDePasse: '123456', // Default password
          service,
          role,
          siteId: site.id
        }
      });
    } catch (err) {
      console.error(`Error importing user ${matricule}:`, err.message);
    }
  }
  
  console.log('Import finished.');
}

importData()
  .catch(console.error)
  .finally(() => prisma.$disconnect());
