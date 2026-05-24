const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '..', 'ListeAgentsDsm.xlsx');
const workbook = XLSX.readFile(filePath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];

const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

let found = 0;
data.forEach((row, idx) => {
  if (row.join('').trim().length > 0) {
    console.log(`Found content at row ${idx}:`, row);
    found++;
  }
});

if (found === 0) console.log('ABSOLUTELY NO DATA FOUND IN ANY ROW');
