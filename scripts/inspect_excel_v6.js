const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '..', 'ListeAgentsDsm.xlsx');
const workbook = XLSX.readFile(filePath);
const sheet = workbook.Sheets[workbook.SheetNames[0]];

const data = XLSX.utils.sheet_to_json(sheet, { header: 1 });

data.forEach((row, index) => {
  if (row && row.length > 0 && row.some(c => c !== null && c !== '')) {
    console.log(`Row ${index}:`, row);
  }
});
