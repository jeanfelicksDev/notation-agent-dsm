const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '..', 'ListeAgentsDsm.xlsx');
const workbook = XLSX.readFile(filePath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];

const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

console.log('Sampling rows 450 to 460:');
for (let i = 450; i < 460; i++) {
  console.log(`Row ${i}:`, data[i]);
}
