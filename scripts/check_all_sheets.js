const XLSX = require('xlsx');
const path = require('path');

const filePath = path.join(__dirname, '..', 'ListeAgentsDsm.xlsx');
const workbook = XLSX.readFile(filePath);

console.log('All Sheets:', workbook.SheetNames);

workbook.SheetNames.forEach(name => {
  const sheet = workbook.Sheets[name];
  const rows = XLSX.utils.sheet_to_json(sheet, { header: 1 });
  console.log(`Sheet "${name}" has ${rows.length} rows.`);
});
