const { createClient } = require('@libsql/client');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'dev.db');
const client = createClient({
  url: 'file:' + dbPath,
});

async function check() {
  try {
    const res = await client.execute("SELECT COUNT(*) as count FROM Affectation");
    console.log("Total affectations:", res.rows[0].count);
    
    // Find the ID of matricule 688991122
    const userRes = await client.execute("SELECT id FROM Utilisateur WHERE matricule = '688991122'");
    if (userRes.rows.length > 0) {
      const evaluateurId = userRes.rows[0].id;
      const affRes = await client.execute({
        sql: "SELECT * FROM Affectation WHERE evaluateurId = ?",
        args: [evaluateurId]
      });
      console.log(`Affectations for evaluateur 688991122 (${evaluateurId}):`, affRes.rows.length);
    } else {
      console.log("User 688991122 not found");
    }
    
    // Is there any open campaign?
    const campRes = await client.execute("SELECT id, statut FROM Campagne WHERE statut = 'OUVERTE'");
    console.log("Open campaigns:", campRes.rows.length);
  } catch (error) {
    console.error(error);
  }
}

check();
