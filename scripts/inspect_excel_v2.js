const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '..', 'ListeAgentsDsm.xlsx');
const workbook = XLSX.readFile(filePath);

const sheetName = workbook.SheetNames[0];
const sheet = workbook.Sheets[sheetName];

// Get raw range
const range = XLSX.utils.decode_range(sheet['!ref']);
console.log('Range:', range);

// Try to get data with different header options
const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });
console.log('Rows:', data.length);
if (data.length > 0) {
  console.log('First 10 rows (raw):', data.slice(0, 10));
}
