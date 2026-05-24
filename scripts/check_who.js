const { createClient } = require('@libsql/client');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'dev.db');
const client = createClient({
  url: 'file:' + dbPath,
});

async function check() {
  try {
    const res = await client.execute("SELECT * FROM Affectation LIMIT 5");
    console.log(res.rows);
    
    // Get the matricule of the first evaluateur
    if (res.rows.length > 0) {
      const evalId = res.rows[0].evaluateurId;
      const userRes = await client.execute({ sql: "SELECT matricule, nom, prenom FROM Utilisateur WHERE id = ?", args: [evalId] });
      console.log("Evaluateur of the first assignment is:", userRes.rows[0]);
    }
  } catch (error) {
    console.error(error);
  }
}

check();
