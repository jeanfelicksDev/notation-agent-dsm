const XLSX = require('xlsx');
const path = require('path');

const wb = XLSX.utils.book_new();

const headers = ['Matricule', 'Nom', 'Prénoms', 'Service', 'Site', 'Status (Collègues/Manager/Externe)'];
const example = [
  ['DSM001', 'KONE', 'Mamadou', 'Informatique', 'Siège', 'Manager'],
  ['DSM002', 'DIALLO', 'Aminata', 'Comptabilité', 'Siège', 'Collègues'],
  ['DSM003', 'TRAORE', 'Fatoumata', 'RH', 'Bouaké', 'Collègues'],
];

const ws = XLSX.utils.aoa_to_sheet([headers, ...example]);

ws['!cols'] = [
  { wch: 18 },
  { wch: 20 },
  { wch: 25 },
  { wch: 25 },
  { wch: 18 },
  { wch: 35 },
];

XLSX.utils.book_append_sheet(wb, ws, 'Agents');

const outPath = path.join(__dirname, '..', 'public', 'templates', 'modele-import-agents.xlsx');
XLSX.writeFile(wb, outPath);

console.log(`Modèle créé : ${outPath}`);
