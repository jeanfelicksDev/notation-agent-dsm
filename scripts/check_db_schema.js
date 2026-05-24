const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, '..', 'dev.db');
const db = new sqlite3.Database(dbPath);

db.all("PRAGMA table_info(Utilisateur);", (err, rows) => {
  if (err) {
    console.error(err);
  } else {
    console.log(rows);
  }
  db.close();
});
