const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '..', 'ListeAgentsDsm.xlsx');
const workbook = XLSX.readFile(filePath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];

const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

console.log('Total rows:', data.length);

for (let i = 0; i < data.length; i++) {
  const row = data[i];
  if (row.length > 0 && row.some(cell => cell !== null && cell !== '')) {
    console.log(`First non-empty row at index ${i}:`, row);
    // Continue to see next few rows
    console.log('Next row:', data[i+1]);
    console.log('Next row:', data[i+2]);
    break;
  }
}
