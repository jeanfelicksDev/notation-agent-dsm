const { createClient } = require('@libsql/client');
const path = require('path');

const dbPath = path.join(__dirname, '..', 'dev.db');
const client = createClient({
  url: 'file:' + dbPath,
});

async function check() {
  try {
    const res = await client.execute("PRAGMA table_info(Utilisateur)");
    console.log(res.rows.map(r => r.name));
  } catch (error) {
    console.error(error);
  }
}

check();
