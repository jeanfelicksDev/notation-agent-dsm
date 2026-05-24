const { createClient } = require('@libsql/client');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'dev.db');
const client = createClient({
  url: 'file:' + dbPath,
});

async function check() {
  try {
    const userRes = await client.execute("SELECT id FROM Utilisateur WHERE matricule = '688991122'");
    if (userRes.rows.length > 0) {
      const evalueId = userRes.rows[0].id;
      const affRes = await client.execute({
        sql: "SELECT * FROM Affectation WHERE evalueId = ?",
        args: [evalueId]
      });
      console.log(`Times 688991122 (${evalueId}) is being evaluated by OTHERS:`, affRes.rows.length);
    }
  } catch (error) {
    console.error(error);
  }
}

check();
