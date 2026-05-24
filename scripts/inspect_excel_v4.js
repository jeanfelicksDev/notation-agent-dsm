const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '..', 'ListeAgentsDsm.xlsx');
const workbook = XLSX.readFile(filePath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];

const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

for (let i = 0; i < 100; i++) {
  const row = data[i];
  if (row && row.length > 0 && row.some(c => c !== null && c !== '')) {
     if (row[0] === 'Matricule') {
       console.log(`Found Header at index ${i}`);
     } else {
       console.log(`Found Data at index ${i}:`, row);
     }
  }
}
