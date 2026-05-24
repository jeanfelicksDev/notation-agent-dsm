const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

async function check() {
  try {
    const users = await prisma.utilisateur.findMany({ take: 1 });
    console.log("Success! Found users:", users);
  } catch (error) {
    console.error("Prisma error:", error.message);
  } finally {
    await prisma.$disconnect();
  }
}

check();
