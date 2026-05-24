const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '..', 'ListeAgentsDsm.xlsx');
const workbook = XLSX.readFile(filePath);

console.log('Sheets:', workbook.SheetNames);

workbook.SheetNames.forEach(sheetName => {
  const sheet = workbook.Sheets[sheetName];
  const data = XLSX.utils.sheet_to_json(sheet);
  console.log(`\n--- Sheet: ${sheetName} ---`);
  console.log('Count:', data.length);
  if (data.length > 0) {
    console.log('First 2 rows:', data.slice(0, 2));
  }
});
